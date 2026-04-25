"""Validation tests for filter Settings."""

from __future__ import annotations

import pytest
from pydantic import ValidationError


def test_default_settings_load() -> None:
    # Reload to bypass lru_cache from previous tests.
    from app.config.settings import Settings

    settings = Settings()
    assert settings.PORT > 0
    assert settings.LOG_LEVEL in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    assert settings.APP_NAME


def test_invalid_log_level_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config.settings import Settings

    monkeypatch.setenv("FILTER_LOG_LEVEL", "VERBOSE")
    with pytest.raises(ValidationError):
        Settings()


def test_log_level_normalised_to_upper(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config.settings import Settings

    monkeypatch.setenv("FILTER_LOG_LEVEL", "debug")
    settings = Settings()
    assert settings.LOG_LEVEL == "DEBUG"


def test_environment_drives_debug(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config.settings import Settings

    monkeypatch.setenv("ENVIRONMENT", "production")
    settings = Settings()
    assert settings.DEBUG is False
