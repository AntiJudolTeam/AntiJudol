"""Standard API response envelope used by every endpoint."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict


class APIResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    status: bool
    data: Any | None = None
    message: str | None = None
    errors: Any | None = None
    timestamp: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


def success_response(data: Any = None, message: str = "Success") -> APIResponse:
    return APIResponse(status=True, data=data, message=message, errors=None, timestamp=_now())


def error_response(message: str = "An error occurred", errors: Any = None, data: Any = None) -> APIResponse:
    return APIResponse(status=False, data=data, message=message, errors=errors, timestamp=_now())
