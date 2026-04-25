"""Shared test fixtures. Stubs the model layer so tests don't need real ML weights."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def stub_predict(monkeypatch: pytest.MonkeyPatch):
    """Replace the model service's predict/predict_batch with deterministic stubs."""
    calls: dict[str, list[Any]] = {"predict": [], "predict_batch": []}

    def fake_predict(text: str) -> dict:
        calls["predict"].append(text)
        gambling = 0.92 if "gacor" in text.lower() else 0.05
        return {"label": 1 if gambling > 0.5 else 0, "normal": 1 - gambling, "gambling": gambling}

    def fake_predict_batch(texts: list[str]) -> list[dict]:
        calls["predict_batch"].append(list(texts))
        return [fake_predict(t) for t in texts]

    monkeypatch.setattr("app.core.services.model_service.predict", fake_predict)
    monkeypatch.setattr("app.core.services.model_service.predict_batch", fake_predict_batch)
    monkeypatch.setattr("app.api.v1.classify.predict", fake_predict)
    monkeypatch.setattr("app.api.v1.classify.predict_batch", fake_predict_batch)
    return calls


@pytest.fixture()
def client(stub_predict) -> TestClient:
    """FastAPI test client with model stubbed out."""
    from app.main import app

    return TestClient(app)
