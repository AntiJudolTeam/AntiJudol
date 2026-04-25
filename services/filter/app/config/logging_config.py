"""Logging setup for the filter service.

One call to ``setup_logging()`` at startup wires console (stdout) and rotating
file handlers. Format mirrors the proxy's tagged style for cross-service
consistency: ``YYYY-MM-DD HH:MM:SS | LEVEL | logger.module | message``.
"""

from __future__ import annotations

import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Final

# services/filter/app/config/logging_config.py → services/filter/logs
LOG_DIR: Final[Path] = (Path(__file__).resolve().parents[2] / "logs").resolve()

LOG_FILE: Final[Path] = LOG_DIR / "server.log"
ERROR_LOG_FILE: Final[Path] = LOG_DIR / "server_error.log"

DETAILED_FORMAT: Final[str] = "%(asctime)s | %(levelname)-7s | %(name)s:%(funcName)s:%(lineno)d | %(message)s"
CONSOLE_FORMAT: Final[str] = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
DATE_FORMAT: Final[str] = "%Y-%m-%d %H:%M:%S"

NOISY_LOGGERS: Final[tuple[str, ...]] = ("uvicorn.access", "uvicorn.error", "fastapi")

_INITIALIZED = False


def setup_logging(level: str = "INFO") -> None:
    """Initialise the root logger with console + rotating file handlers.

    Idempotent — safe to call from both module import and tests.
    """
    global _INITIALIZED
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    target_level = getattr(logging, level.upper(), logging.INFO)
    root.setLevel(target_level)

    # Replace handlers on every call — supports hot-reload without duplicates.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    console = logging.StreamHandler()
    console.setLevel(target_level)
    console.setFormatter(logging.Formatter(CONSOLE_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(console)

    file_handler = TimedRotatingFileHandler(
        LOG_FILE, when="midnight", interval=1, backupCount=30, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(DETAILED_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(file_handler)

    error_handler = TimedRotatingFileHandler(
        ERROR_LOG_FILE, when="midnight", interval=1, backupCount=30, encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(DETAILED_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(error_handler)

    for noisy in NOISY_LOGGERS:
        logging.getLogger(noisy).setLevel(logging.WARNING)

    if not _INITIALIZED:
        root.info("logging initialised | level=%s | log_dir=%s", level, LOG_DIR)
        _INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger; inherits handlers from the root once setup_logging ran."""
    return logging.getLogger(name)
