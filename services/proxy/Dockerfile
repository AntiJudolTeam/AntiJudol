# syntax=docker/dockerfile:1.7

# ─── Builder ─────────────────────────────────────────────────────────────────
# Installs deps, bundles the inject script, and pre-warms the curl-impersonate
# binary. Everything ML/dev-only stays out of the runtime image.
FROM oven/bun:1-debian AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build:inject \
 && bun -e 'import("cuimp").then(m => m.downloadBinary({ descriptor: { browser: "chrome" } }))'

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM oven/bun:1-debian AS runtime

# wget is the lightest healthcheck client already present on debian-slim images;
# fall back to apt only if it's missing.
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The official bun image already provides a non-root `bun` user.
COPY --from=builder --chown=bun:bun /app /app
# cuimp caches its binary in $HOME — copy from the builder's root home.
COPY --from=builder --chown=bun:bun /root/.cuimp /home/bun/.cuimp
ENV HOME=/home/bun

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO - http://127.0.0.1:${PROXY_PORT:-3000}/ > /dev/null || exit 1

CMD ["bun", "run", "src/server.js"]
