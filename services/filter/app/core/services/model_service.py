"""Hugging Face classifier wrapper. Loads once at startup; thread-safe for inference."""

from __future__ import annotations

import threading
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from app.config.logging_config import get_logger
from app.config.settings import get_settings

logger = get_logger(__name__)
settings = get_settings()

# services/filter/app/core/services/model_service.py → services/filter/model
MODEL_DIR: Path = (Path(__file__).resolve().parents[3] / "model").resolve()

_LABEL_NORMAL = 0
_LABEL_GAMBLING = 1

_lock = threading.Lock()
_tokenizer = None
_model = None


def _load_model() -> None:
    """Load tokenizer + model into module-level state. Idempotent."""
    global _tokenizer, _model
    with _lock:
        if _tokenizer is not None and _model is not None:
            return

        if not MODEL_DIR.is_dir():
            raise FileNotFoundError(
                f"Model directory not found at '{MODEL_DIR}'. "
                "Place model artifacts (config.json, model.safetensors, tokenizer files) there "
                "or run `hf download RaCas/judi-online --local-dir model`."
            )

        logger.info("loading model from %s", MODEL_DIR)
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        _model.eval()
        logger.info("model loaded")


def _infer(texts: list[str]) -> list[tuple[int, float, float]]:
    """Run inference on a batch; returns (label, normal_prob, gambling_prob) tuples."""
    if _tokenizer is None or _model is None:
        _load_model()

    inputs = _tokenizer(
        texts,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=settings.MODEL_MAX_LENGTH,
    )
    with torch.no_grad():
        logits = _model(**inputs).logits
    probs = torch.softmax(logits, dim=1)

    out: list[tuple[int, float, float]] = []
    for row in probs:
        normal = float(row[_LABEL_NORMAL])
        gambling = float(row[_LABEL_GAMBLING])
        label = _LABEL_GAMBLING if gambling > normal else _LABEL_NORMAL
        out.append((label, normal, gambling))
    return out


def predict(text: str) -> dict:
    """Classify a single text. Returns {label, normal, gambling}."""
    label, normal, gambling = _infer([text])[0]
    logger.debug(
        "predict | label=%d gambling=%.3f normal=%.3f text=%.60s",
        label,
        gambling,
        normal,
        text,
    )
    return {"label": label, "normal": normal, "gambling": gambling}


def predict_batch(texts: list[str]) -> list[dict]:
    """Classify a batch. Empty strings get a single space to keep the tokenizer happy."""
    if not texts:
        return []

    logger.info("predict_batch | n=%d", len(texts))
    safe_texts = [t if t else " " for t in texts]

    results: list[dict] = []
    batch_size = settings.MODEL_BATCH_SIZE
    for i in range(0, len(safe_texts), batch_size):
        chunk = safe_texts[i : i + batch_size]
        for label, normal, gambling in _infer(chunk):
            results.append({"label": label, "normal": normal, "gambling": gambling})
    return results
