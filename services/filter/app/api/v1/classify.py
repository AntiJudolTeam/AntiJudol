"""Classification endpoints (v1)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config.logging_config import get_logger
from app.core.services.model_service import predict, predict_batch
from app.utils.response_formatter import APIResponse, success_response

logger = get_logger(__name__)
router = APIRouter(prefix="/classify", tags=["Classify"])


class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1)


class BatchPredictRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1)


class PredictResponse(BaseModel):
    text: str
    label: int  # 0 = non-gambling, 1 = gambling
    normal: float
    gambling: float


@router.post("/predict", response_model=APIResponse)
async def predict_single(payload: PredictRequest):
    logger.debug("classify | predict len=%d", len(payload.text))
    try:
        result = predict(payload.text)
    except (FileNotFoundError, RuntimeError) as err:
        logger.error("classify | predict failed: %s", err)
        raise HTTPException(status_code=500, detail=str(err)) from err

    logger.info("classify | label=%d gambling=%.4f", result["label"], result["gambling"])
    return success_response(data=PredictResponse(text=payload.text, **result))


@router.post("/predict/batch", response_model=APIResponse)
async def predict_batch_endpoint(payload: BatchPredictRequest):
    logger.info("classify | batch n=%d", len(payload.texts))
    try:
        results = predict_batch(payload.texts)
    except (FileNotFoundError, RuntimeError) as err:
        logger.error("classify | batch failed: %s", err)
        raise HTTPException(status_code=500, detail=str(err)) from err

    gambling_count = sum(1 for r in results if r["label"] == 1)
    logger.info("classify | batch done n=%d gambling=%d", len(results), gambling_count)
    items = [PredictResponse(text=t, **r) for t, r in zip(payload.texts, results, strict=True)]
    return success_response(data=items)
