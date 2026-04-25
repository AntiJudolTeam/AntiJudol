"""FastAPI entry point — wires logging, lifespan model preload, error handlers, and routes."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config.logging_config import get_logger, setup_logging
from app.config.settings import get_settings
from app.utils.response_formatter import error_response, success_response

settings = get_settings()
setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


def _preload_ml_model() -> None:
    """Synchronous wrapper around model loading; runs in a worker thread."""
    from app.core.services.model_service import _load_model

    try:
        _load_model()
    except (FileNotFoundError, RuntimeError, OSError) as err:
        # Service stays up — first /predict call will retry and surface a 500.
        logger.warning("model preload failed: %s", err)


_preload_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _preload_task
    logger.info("startup | %s v%s", settings.APP_NAME, settings.APP_VERSION)
    _preload_task = asyncio.create_task(asyncio.to_thread(_preload_ml_model))
    yield
    logger.info("shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="FastAPI backend for classifying gambling text.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.warning("http %d | %s %s | %s", exc.status_code, request.method, request.url.path, exc.detail)
    payload = error_response(message=str(exc.detail))
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("validation | %s %s | %s", request.method, request.url.path, exc.errors())
    payload = error_response(message="Validation error", errors=exc.errors())
    return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))


app.include_router(api_router)


@app.get("/", tags=["Health"])
async def root():
    return success_response(
        data={"app": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"},
        message="Server is running",
    )


@app.get("/health", tags=["Health"])
async def health():
    return success_response(data={"status": "ok"}, message="Healthy")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
