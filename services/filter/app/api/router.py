from fastapi import APIRouter

from app.api.v1.classify import router as classify_router

api_router = APIRouter(prefix="/api/v1")

# Classify endpoints
api_router.include_router(classify_router)
