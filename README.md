# AntiJudol

Proxy + classifier stack that intercepts streaming donation overlay widgets, inspects donations in real-time, and replaces gambling-promotion ("judol") content at the data source — before the overlay renders it. TTS audio for blocked donations is stripped too.

## Supported Platforms

| Platform                           | Alert | Mediashare | CF Bypass         |
| ---------------------------------- | ----- | ---------- | ----------------- |
| [Saweria](https://saweria.co)      | ✅    | ✅         | —                 |
| [Tako](https://tako.id)            | ✅    | ✅         | —                 |
| [BagiBagi](https://bagibagi.co)    | ✅    | ✅         | curl-impersonate  |
| [Sociabuzz](https://sociabuzz.com) | ✅    | ✅         | —                 |

## How It Works

1. The **proxy** fetches the platform's overlay HTML and injects a small browser hook bundle.
2. The hook intercepts WebSocket / fetch / XHR donation traffic in the browser.
3. Each donation is sent to `POST /check` for a verdict.
4. Blocked donations have donor name, message, and TTS audio replaced/removed at the source.

The verdict comes from one of two filters:

- **`algorithm`** (default for local dev) — fast pattern/wordlist filter built into the proxy. No Python required.
- **`classifier`** (default in Docker) — the proxy POSTs each donation to the filter service, which runs an ML classifier. Set `PROXY_FILTER_METHOD=classifier` and `PROXY_FILTER_URL=http://...` to use it.

## Repository Layout

```
AntiJudol/
├── services/
│   ├── proxy/        Bun/Express proxy — interception, injection, decision routing
│   └── filter/       FastAPI ML classifier service
├── docker-compose.yml
├── .env.example      Single source of truth for runtime config
└── Makefile          Convenience targets for local dev
```

Service-specific docs live in [`services/proxy/README.md`](services/proxy/README.md) and [`services/filter/README.md`](services/filter/README.md). Architecture deep-dive lives in [`AGENTS.md`](AGENTS.md).

## Quick Start (Docker — recommended)

```bash
cp .env.example .env       # optional — defaults work for production deployment
docker compose up --build
```

The proxy will be available at <http://localhost:3000>. The filter service is internal-only — it's reachable from `proxy` over the `antijudol` network but not exposed to the host.

## Quick Start (Local dev)

Requires [Bun 1.2+](https://bun.com/) and Python 3.10+ if using the classifier filter.

```bash
make install        # bun install + pip install -r requirements.txt
make dev            # runs proxy + filter concurrently; Ctrl-C kills both
make dev-proxy      # proxy only (uses built-in algorithm filter, no Python)
make test           # runs proxy test suite
```

The proxy auto-bundles `client/inject.js` → `public/inject.js` on every `bun dev`/`start`/`test`.

## Usage

1. Open <http://localhost:3000>
2. Paste your overlay URL
3. Copy the generated AntiJudol URL
4. Use it as a Browser Source in OBS

### Direct URL forms

```text
http://localhost:3000/overlay?platform=saweria&overlayType=alert&streamKey=YOUR_KEY
http://localhost:3000/overlay?platform=tako&overlayType=alert&streamKey=YOUR_KEY
http://localhost:3000/overlay?platform=bagibagi&streamKey=YOUR_KEY
http://localhost:3000/overlay?platform=sociabuzz&overlayType=alert&streamKey=YOUR_KEY
```

## Configuration

All config is environment-driven. Variable names are namespaced (`PROXY_*`, `FILTER_*`) so it's always clear which service owns a given knob. The complete list with descriptions is in [`.env.example`](.env.example).

Highlights:

| Variable                   | Default       | Service | Purpose                              |
| -------------------------- | ------------- | ------- | ------------------------------------ |
| `ENVIRONMENT`              | `development` | shared  | `development` or `production`        |
| `PROXY_PORT`               | `3000`        | proxy   | Public port                          |
| `PROXY_FILTER_METHOD`      | `algorithm`   | proxy   | `algorithm` or `classifier`          |
| `PROXY_FILTER_URL`         | `http://localhost:9000` | proxy | Where to reach the filter service |
| `PROXY_KILL_SWITCH_PATH`   | `.killswitch` | proxy   | Filename or path; presence = bypass  |
| `PROXY_BLOCK_MESSAGE`      | (Indonesian)  | proxy   | Replacement text for blocked messages |
| `FILTER_PORT`              | `9000`        | filter  | Internal port (not host-published)   |
| `FILTER_LOG_LEVEL`         | `INFO`        | filter  | DEBUG/INFO/WARNING/ERROR/CRITICAL    |

## Kill Switch

Touch the file at `PROXY_KILL_SWITCH_PATH` to force `/check` to return `allow` for every request — useful if the filter misbehaves during a live stream. Remove the file to re-arm.

```bash
make kill-on        # auto-detects local vs docker
make kill-off
```

## Filter

The built-in `algorithm` filter lives in [`services/proxy/src/filter/`](services/proxy/src/filter/). Blocklists (`data/blocklist.js`), Indonesian dictionary (`data/wordlist-indonesia.txt`), and the auto-generated homoglyph fold table (`src/filter/homoglyphs.js`) are all data-driven.

The ML `classifier` filter is a separate FastAPI service in [`services/filter/`](services/filter/). It loads a Hugging Face model at startup and exposes `/api/v1/classify/predict` and `/api/v1/classify/predict/batch`.

## Testing

```bash
# Proxy
cd services/proxy && bun test

# Filter
cd services/filter && python -m pytest
```

## Tech Stack

- **Bun** + **Express** — proxy runtime and bundler
- **FastAPI** + **PyTorch** + **Transformers** — ML classifier
- **[cuimp](https://www.npmjs.com/package/cuimp)** wrapping **[curl-impersonate](https://github.com/lexiforest/curl-impersonate)** — Cloudflare bypass for protected platforms

## Authors

[AntiJudol Team](https://github.com/AntiJudolTeam)
