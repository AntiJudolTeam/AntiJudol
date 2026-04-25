# AntiJudol Filter Service

FastAPI classifier that scores text for gambling-promotion content. Used by the proxy when `PROXY_FILTER_METHOD=classifier`.

For the project overview and Docker setup, see the [root README](../../README.md).

## What It Does

- Single + batch text classification via a Hugging Face model
- Returns probability scores for `normal` and `gambling`, plus a final label
- Loads the model once at startup; thread-safe inference path

| Label | Meaning      |
| ----- | ------------ |
| `0`   | non-gambling |
| `1`   | gambling     |

## Layout

```
app/
  main.py                   FastAPI app + lifespan model preload
  api/
    router.py               Aggregates v1 endpoints
    v1/classify.py          /api/v1/classify endpoints
  config/
    settings.py             pydantic-settings (FILTER_* env prefix)
    logging_config.py       Console + rotating file handlers
  core/services/
    model_service.py        Tokenizer + model lifecycle, predict/predict_batch
  utils/response_formatter.py  APIResponse envelope (status, data, message, errors, timestamp)
tests/                      pytest suite (model-stubbed)
model/                      HF model artefacts — download separately, gitignored
pyproject.toml              dependencies + ruff/pytest config
requirements.txt            Pinned deps for Docker
```

## Setup (local)

Requires Python 3.10+.

```bash
# create + activate venv
python -m venv .venv
source .venv/bin/activate    # PowerShell: .venv\Scripts\Activate.ps1

# editable install with dev tools (pytest, ruff)
pip install -e ".[dev]"

# download the model (~500MB)
hf download RaCas/judi-online --local-dir model

# run
python -m app.main
# or with reload:  ENVIRONMENT=development python -m app.main
```

The server reads its bind address and port from `FILTER_HOST` / `FILTER_PORT`. Defaults are `127.0.0.1:9000`.

## API

OpenAPI docs auto-served at:

- Swagger UI: `http://localhost:9000/docs`
- ReDoc:      `http://localhost:9000/redoc`

### Health

```http
GET /
GET /health
```

### Predict (single)

```http
POST /api/v1/classify/predict
Content-Type: application/json

{ "text": "link gacor terbaru" }
```

### Predict (batch)

```http
POST /api/v1/classify/predict/batch
Content-Type: application/json

{ "texts": ["promo normal", "slot terpercaya"] }
```

### Response Envelope

All endpoints share this shape:

```json
{
  "status": true,
  "data": {},
  "message": "Success",
  "errors": null,
  "timestamp": "2026-04-25T00:00:00+00:00"
}
```

Prediction item:

```json
{
  "text": "string",
  "label": 0,
  "normal": 0.9987,
  "gambling": 0.0013
}
```

## Configuration

Configuration is read from the **root `.env`** (one source of truth across services). All knobs are `FILTER_*`-prefixed; pydantic-settings strips the prefix internally so code reads `settings.PORT`, etc.

| Variable                  | Default       | Description                                     |
| ------------------------- | ------------- | ----------------------------------------------- |
| `FILTER_HOST`             | `127.0.0.1`   | Bind address                                    |
| `FILTER_PORT`             | `9000`        | Service port (internal-only in Docker)          |
| `FILTER_LOG_LEVEL`        | `INFO`        | DEBUG / INFO / WARNING / ERROR / CRITICAL       |
| `FILTER_CORS_ORIGINS`     | `["*"]`       | JSON list of allowed origins                    |
| `FILTER_MODEL_BATCH_SIZE` | `32`          | Tokenizer/model batch size                      |
| `FILTER_MODEL_MAX_LENGTH` | `512`         | Tokenizer max sequence length                   |
| `ENVIRONMENT`             | `development` | Drives `DEBUG` (reload + verbose docs)          |

`APP_NAME` and `APP_VERSION` are **build identity** — hardcoded in `app/config/settings.py`, not env-driven.

## Logging

Logs go to `logs/`:

- `server.log` (DEBUG+, rotated daily, keeps 30 days)
- `server_error.log` (ERROR+, rotated daily, keeps 30 days)

Console output mirrors the proxy's tagged style: `YYYY-MM-DD HH:MM:SS | LEVEL | logger | message`.

## Testing

```bash
pip install -e ".[dev]"
pytest
```

Tests stub the model service with deterministic fakes — no GPU/CPU inference needed.

## Linting

```bash
ruff check app tests
ruff format app tests
```

## Tech Stack

- FastAPI + Uvicorn
- Pydantic v2 + pydantic-settings
- Hugging Face Transformers
- PyTorch (CPU-only build in Docker — see `Dockerfile`)

## Troubleshooting

**Model directory not found** — ensure `model/` exists and contains `config.json`, `model.safetensors`, and tokenizer files. Run `hf download RaCas/judi-online --local-dir model` if missing.

**Permission denied on `/app/logs/server.log` (Docker)** — the runtime user is `app` (uid 10001). The compose file uses a named volume (`filter_logs`) so this is handled automatically; if you bind-mount instead, ensure the host directory is writable by uid 10001.

**Filter is unhealthy in Docker** — first-start model load can take ~30s on slow hardware. The healthcheck has `start_period: 30s` to absorb this; bump it via a compose override if your hardware is slower.

## Authors

[AntiJudol Team](https://github.com/AntiJudolTeam)
