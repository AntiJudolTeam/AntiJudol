# syntax=docker/dockerfile:1.7

# --- Builder -----------------------------------------------------------------
# Pulls CPU-only torch + dependencies and downloads the model. Keeping pip
# off the runtime image shaves ~150MB.
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --prefix=/install torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --prefix=/install -r requirements.txt

# Pre-download the model so the runtime image is self-contained.
ARG HF_MODEL=RaCas/judi-online
ENV PYTHONPATH=/install/lib/python3.12/site-packages
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='${HF_MODEL}', local_dir='/build/model')"

# --- Runtime -----------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/usr/local/lib/python3.12/site-packages

# libgomp is required by torch on Linux. wget powers the HEALTHCHECK.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 wget \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 10001 --user-group --create-home --shell /usr/sbin/nologin app

WORKDIR /app

# Copy installed packages from builder.
COPY --from=builder /install /usr/local

# Copy model artefacts and app source.
COPY --from=builder --chown=app:app /build/model /app/model
COPY --chown=app:app app/ /app/app/

# Logs directory must be writable for the non-root user.
RUN mkdir -p /app/logs && chown app:app /app/logs

USER app

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO - http://127.0.0.1:${FILTER_PORT:-9000}/health > /dev/null || exit 1

CMD ["python", "-m", "app.main"]
