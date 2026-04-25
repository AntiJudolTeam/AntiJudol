# AGENTS.md — AntiJudol

## Project Overview

AntiJudol is a Bun/Express proxy server that intercepts streaming donation overlay widgets (Saweria, Tako, BagiBagi, Sociabuzz), inspects donation messages in real-time, and replaces blocked content (gambling promotion) at the data source before the overlay renders it. Blocked donations also have their TTS audio stripped.

## Architecture

```
Browser/OBS → localhost:3000/overlay → src/server.js → src/routes/proxy/overlay.js → platform HTML
                                                                ↓
                                                 public/inject.js (bundled from client/)
                                                                ↓
                                                     hooks WS/fetch/XHR in browser
                                                                ↓
                                                 Sync XHR to /check (src/routes/api/check.js)
                                                                ↓
                                                 Modify WS/fetch data → overlay renders filtered content
```

### Repository Layout

The project is a multi-service monorepo. Each service lives under `services/<name>/`.

```
AntiJudol/
├── services/
│   ├── proxy/                Bun/Express proxy — interception, injection, decision routing
│   │   ├── src/ client/ public/ data/ scripts/ tests/
│   │   ├── package.json, bun.lock
│   │   └── Dockerfile
│   └── filter/               FastAPI classifier — ML-based gambling detection
│       ├── app/              FastAPI app code
│       ├── model/            ML model artifacts (download separately, not in git)
│       ├── requirements.txt
│       └── Dockerfile
├── docker-compose.yml        Orchestrates all services
├── .dockerignore
├── .env.example              Single source of truth for env vars (namespaced PROXY_*/FILTER_*)
├── Makefile                  Local Bun + kill-switch shortcuts
├── AGENTS.md / CLAUDE.md / README.md
```

Run commands from a service directory (`cd services/proxy && bun dev`) or via `docker compose` from the repo root. Paths in the **Proxy Service Structure** section below are relative to `services/proxy/`.

### Filter Service (services/filter/)

FastAPI classifier exposing `/api/v1/classify/predict` and `/api/v1/classify/predict/batch`. Loads a Hugging Face model from `model/` at startup. Used by proxy when `PROXY_FILTER_METHOD=classifier`. See `services/filter/README.md` for setup, endpoints, and model download instructions.

The proxy chooses between the in-process algorithm (`src/filter/judolFilter.js`) and the classifier service via `PROXY_FILTER_METHOD`:

- `algorithm` (default for local dev) — uses the built-in pattern/wordlist filter, no Python needed.
- `classifier` — proxy POSTs each donation to `PROXY_FILTER_URL` and uses the model's verdict directly. Falls back to algorithm on classifier failure.
- `both` (recommended in Docker) — runs both. The classifier's `gambling` probability is mapped to ±5 score points and folded into `decide()`'s existing scoring, so a confident classifier can either push a borderline case over the block threshold or pull it back. A `gambling >= 0.85` reading additionally short-circuits the default-allow path with stage `classifier-confident`. Algorithm "block" verdicts are never downgraded by the classifier — signature matches always win. Anti-judol context is also never overridden.

### Proxy Service Structure

```
src/                          Server-side code (Bun/Node)
  server.js                   Entry point — validates config, pre-downloads impersonate binary, starts Express
  config.js                   Environment-driven runtime config
  constants.js                Wire-protocol constants
  platforms.js                Platform configuration registry
  routes/
    index.js                  Route aggregator + JSON body parser
    api/
      check.js                POST /check — donation filter endpoint
    proxy/
      overlay.js              GET /overlay — HTML proxy + injection + native path rewrites
      backend.js              /backend/:platform/* — API proxy
      assets.js               Catch-all — static asset proxy
    web/
      static.js               express.static over public/ (serves index.html + bundled inject.js)
  antibot/
    index.js                  fetchViaAntibot facade — forwards to impersonate
    impersonate.js            cuimp (curl-impersonate) client with cookie jar
  filter/
    judolFilter.js            decide(donator, message) → {action, stage, reason}
    classifier.js             HTTP client for the FastAPI filter service
    normalizeText.js          Homoglyph/leet/decoration normalization with variant expansion
    typoMatcher.js            Fuzzy Indonesian dictionary matcher (canonicalization, near-miss scoring)
    textUtils.js              Shared regexes (chains, leet) + foldLeet, tightenIntraWord, levenshtein
    wordlist.js               Loads data/wordlist-indonesia.txt; exposes SENSITIVE_TERMS
    homoglyphs.js             AUTO-GENERATED fold table — do not hand-edit
  utils/
    cfStrip.js                Remove Cloudflare Rocket Loader + challenge script tags from overlay HTML
    donationLog.js            Append per-donation decisions to logs/
    feedbackLog.js            Append /feedback submissions to logs/
    helpers.js                getPlatformFromCookie, getPlatformFromReferer, injectScripts
    killSwitch.js             isKillSwitchActive() — checks PROXY_KILL_SWITCH_PATH existence
    logFile.js                Shared log-path / sanitise / rotation helpers
    logger.js                 Leveled tagged console logger
    paths.js                  PROJECT_ROOT, PUBLIC_DIR, DATA_DIR, LOG_DIR
    platformMiddleware.js     resolvePlatform() — dispatch on query/cookie/referer
    rateLimit.js              In-memory per-IP rate limiter
    validation.js             asString/asNumberOrNull body coercion

client/                       Browser-side code (bundled, not run directly by Bun)
  inject.js                   IIFE entry — WS/fetch/XHR hooks, sync /check call, MessageEvent delivery
  wsProtocol/
    saweria.js                parse(raw) + modify(raw, replacement)
    bagibagi.js                parse + modify with \x1e SignalR framing
    sociabuzz.js              parse + modify with nested JSON in messages[].data
    tako.js                   detectDonationSignal, parseFetchBody, modifyFetchBody

public/                       HTTP-served static files
  inject.js                   BUILD OUTPUT — bundled from client/inject.js via `bun build`
  index.html                  Web UI — overlay URL converter
  (icons, manifest, etc.)

data/
  blocklist.js                Brands, STRONG/WEAK patterns, SUSPICIOUS_NAME patterns, LEET map
  wordlist-indonesia.txt      Dictionary used by filter/typoMatcher for near-miss detection

scripts/
  build-homoglyphs.js         Regenerate src/filter/homoglyphs.js from scripts/charset.json
  charset.json                Upstream homoglyph dump (source of truth for folds)

tests/
  judolFilter.test.js         End-to-end decision coverage
  normalizeText.test.js       Variant expansion + data-driven fold coverage
  typoMatcher.test.js         Dictionary/sensitive matcher + canonicalization
  client/
    wsProtocol.test.js        Per-platform parse + modify (no browser needed)
```

### Build Pipeline

`client/inject.js` uses ES imports, so it is **bundled** into `public/inject.js` before being served. The bundle is produced by:

```bash
bun run build:inject
# → bun build client/inject.js --outfile public/inject.js --target browser --format iife
```

`bun dev`, `bun start`, and `bun test` all run `build:inject` first, so in normal workflows you never invoke it directly. Edit `client/inject.js` or any `client/wsProtocol/*.js`, rerun, and the bundled output is regenerated.

### Core Concepts

**Donation Filtering (client/):**
Donations are modified at the source — before the overlay processes them. No DOM manipulation.

- **WS-based platforms** (Saweria, BagiBagi, Sociabuzz): `deliverWsMessage()` in `client/inject.js` intercepts WebSocket message events. `filterWsData()` parses the raw WS string via `client/wsProtocol/{platform}.parse`, sends a synchronous XHR to `/check`, and if blocked, rewrites the raw data via `client/wsProtocol/{platform}.modify`. A new `MessageEvent` with modified data is delivered to the overlay's listener.
- **Fetch-based platforms** (Tako): The fetch hook intercepts the response, parses the JSON body via `client/wsProtocol/tako.parseFetchBody`, checks via sync XHR, and returns a new `Response` with modified JSON (via `modifyFetchBody`) if blocked. The WS signal that triggers the fetch is recognized by `tako.detectDonationSignal`.
- **TTS handling**: Blocked donations have TTS audio nulled/deleted by the `modify` function. Saweria: `tts = null`. BagiBagi: `audioData = null`. Sociabuzz: `delete tts` + `delete voice_note`. Tako: TTS is server-generated from the replaced text (reads "[blocked]" instead of original).
- **Sync XHR**: `checkSync()` uses synchronous `XMLHttpRequest` to `/check` so data can be modified before delivery. Localhost latency is <10ms.

Because every `wsProtocol/*.js` is a pure module (no DOM, no window), the per-platform protocol logic is unit-testable in Bun. See `tests/client/wsProtocol.test.js`.

**Server-side Filter (src/filter/):**

- `decide(donator, message)` returns `{ action: "block" | "allow", stage, reason }`.
- `normalizeText(text, { maxVariants })` expands obfuscated text into ASCII variants by folding homoglyphs, stripping decorations, and applying leet substitutions. Brands/patterns match against every variant.
- `typoMatcher` fuzzy-matches tokens against the Indonesian dictionary (`data/wordlist-indonesia.txt`) and a sensitive-term set to catch near-miss obfuscations.
- The fold table (`src/filter/homoglyphs.js`) is **auto-generated** from `scripts/charset.json`; edit the source JSON and rerun `bun scripts/build-homoglyphs.js`.

**Proxy Layers (src/routes/proxy/):**

1. **overlay.js** (`/overlay`) — Fetches platform overlay HTML, injects config + inject.js, rewrites URLs for framework hydration (`history.replaceState`). `cfStrip.stripCloudflareArtifacts` runs on impersonate responses to remove Rocket Loader / challenge script tags.
2. **backend.js** (`/backend/:platform/*`) — Proxies API requests with platform-specific headers. Forwards dynamic headers (e.g. Tako's `x-queued-gift-ids`, `x-played-gift-ids`, `authorization`). When `platform.useImpersonate` is set, the raw response `Buffer` is forwarded untouched — essential for binary endpoints like BagiBagi's `/api/tts` (MP3 audio).
3. **assets.js** (catch-all) — Proxies static assets (JS/CSS/fonts). Retries text resources via impersonate on CF 403 for platforms with `useImpersonate: true`.

**Script Injection (src/utils/helpers.js):**

`injectScripts()` inlines the bundled `public/inject.js` (read at server startup) into the overlay HTML. For Cloudflare-protected platforms, the whole bundle is embedded inline inside `<script data-cfasync="false">` to bypass Rocket Loader rewrites. For others, a `<script src="/inject.js">` tag is emitted and `express.static` (from `src/routes/web/static.js`) serves the bundle.

**Anti-bot (src/antibot/):**

- Single provider: `impersonate.js` spawns `curl-impersonate` via [cuimp](https://www.npmjs.com/package/cuimp) with `--impersonate chrome116 --compressed`.
- Shared `createCuimpHttp` instance keeps a cookie jar so `cf_clearance` set on the overlay GET is replayed automatically on subsequent API calls.
- `fetchViaAntibot(url, {method, headers, body})` returns `{ data, rawBody, contentType, status }` where `rawBody` is the untouched `Buffer` — binary-safe for TTS audio.
- On Windows, cuimp has quirks we work around in `impersonate.js`: it omits `--impersonate`, omits `--compressed`, and re-downloads the binary every boot when `version` is pinned. Fix: pass the resolved `binaryPath` explicitly to `createCuimpHttp` after `downloadBinary()`, and set the flags via `extraCurlArgs`.

**Kill Switch (src/utils/killSwitch.js):**
If the file at `KILL_SWITCH_PATH` exists, `/check` short-circuits to `allow` for every request and logs the bypass. Touch the file to pause filtering during a live stream without restarting the server; `rm` to re-arm. Path resolution is relative to the service root (two levels up from `src/utils/`, i.e. `services/proxy/`). Under Docker, toggle via `docker compose exec proxy touch /app/.killswitch` (and `rm` to disable).

## Platform-Specific Details

### Saweria

- **Overlay**: `/widgets/{alert|mediashare}?streamKey=xxx`
- **Backend**: Separate origin `backend.saweria.co`
- **WS data**: `{"data":[{"donator":"...","message":"...","tts":[...]}],"type":"donation"}`
- **Auth**: `stream-key` header
- **TTS**: Base64 audio blobs in `tts` array — set to `null` when blocked (see `client/wsProtocol/saweria.js`)

### Tako

- **Overlay**: `/overlay/{alert|mediashare}?overlay_key=xxx`
- **Backend**: Same-origin `/api/*`
- **Donation flow**: WS signal `{"event":"messages"}` → overlay fetches `/api/overlay/{key}` → response contains donation → fetch hook intercepts and modifies if blocked
- **Critical headers**: `x-queued-gift-ids`, `x-played-gift-ids`, `authorization` — forwarded via `forwardHeaders`
- **Gift lifecycle**: Display → PUT to `/api/overlay/{key}` with `x-played-gift-ids` marks gift as done
- **TTS**: Server-generated from replaced text via `/api/overlay/{key}/tts?text=...` — reads blocked text naturally
- **Framework**: Next.js — requires `history.replaceState` for hydration
- **Protocol module**: `client/wsProtocol/tako.js` exports `detectDonationSignal`, `parseFetchBody`, `modifyFetchBody` (not the parse/modify pair used by WS platforms)

### BagiBagi

- **Overlay**: `/alertbox/{key}` (single URL for alert + mediashare)
- **Backend**: Same-origin `/api/*`, Cloudflare protected
- **Cloudflare bypass**: `useImpersonate: true`. All GETs and the `/api/tts` POST go through curl-impersonate (chrome116 fingerprint) with a persistent cookie jar.
- **Rocket Loader**: CF mangles script `type` attributes on bagibagi (e.g. `abc123-module`). `cfStrip.stripCloudflareArtifacts` removes CF scripts and fixes attribute prefixes before injection.
- **TTS**: Overlay POSTs JSON `{voiceName, message}` to `/api/tts`; server returns MP3 bytes. Proxied through `backend.js` with `result.rawBody` passed to `res.send()` so the audio isn't UTF-8 corrupted.
- **WS protocol**: SignalR — messages end with `\x1e` record separator (stripped on parse, re-appended on modify in `client/wsProtocol/bagibagi.js`)
- **WS data**: `{"type":1,"target":"Donation","arguments":[{"preferedName":"...","message":"..."}]}`
- **Note**: Also sends `"UserDonated"` event — only parse `"Donation"`

### Sociabuzz

- **Overlay**: `/pro/tribe/alert1/v3/{key}` (alert), `/pro/tribe/mediashare/v2/{key}` (mediashare)
- **Backend**: Same-origin `/pro/*`
- **WS protocol**: Ably — `action: 15` with nested JSON string in `messages[].data`
- **WS data**: `{"action":15,"messages":[{"data":"{\"fullname\":\"...\",\"note\":\"...\",\"tts\":\"https://...\"}"}]}`
- **Inner JSON**: `data` field is a stringified JSON — must parse, modify, and re-stringify back to `m.data` (see `client/wsProtocol/sociabuzz.js`)
- **TTS**: Pre-generated audio URL — `delete x.tts` and `delete x.voice_note` when blocked
- **Styling**: Config passed via URL query params (colors, fonts, etc.) — preserved through `extraParams` and native path rewrites

## Request Flow

### Overlay HTML Serving

```
GET /overlay?platform=saweria&overlayType=alert&streamKey=xxx
  → src/routes/proxy/overlay.js
  → getPlatform("saweria")
  → platform.overlayUrl({streamKey, overlayType, extraParams})
  → fetch HTML (direct or via impersonate if useImpersonate)
  → [impersonate] stripCloudflareArtifacts() — drop CF Rocket Loader / challenge tags
  → injectScripts() (src/utils/helpers.js):
      - inline <script data-cfasync="false">…bundled inject.js…</script> for CF-protected
      - external <script src="/inject.js"> for others (served by express.static from public/)
  → Set-Cookie: antijudol_platform=saweria
  → serve HTML
```

### Donation Check Flow (client/inject.js)

```
WS message arrives in browser
  → deliverWsMessage(event, listener, context)
  → checkTakoWsSignal() — calls tako.detectDonationSignal for Tako trigger frames
  → filterWsData(rawData)
    → wsProtocol[platform].parse(raw) → [{donator, message, amount, currency}]
    → checkSync(donation) → sync XHR POST /check
    → if blocked: wsProtocol[platform].modify(raw, result) → modified raw string
  → deliver MessageEvent (modified or original) to overlay listener

For Tako, the fetch hook additionally:
  → on /api/overlay/{key} response if wsDonationTriggered flag is set
  → tako.parseFetchBody(data) → donation
  → checkSync + tako.modifyFetchBody(data, result) → new Response with replaced JSON
```

### Backend API Proxying

```
POST /backend/bagibagi/api/tts?streamKey=xxx
  → src/routes/proxy/backend.js
  → strip /backend/:platform prefix → backendPath
  → platform.backendHeaders() + forwardHeaders from browser request
  → [useImpersonate] fetchViaAntibot with method/headers/body → res.send(result.rawBody)
  → [others]        fetch(targetUrl) → res.send(Buffer.from(arrayBuffer))
```

### Platform Detection (catch-all)

Priority: `antijudol_platform` cookie → Referer `platform` query param → default "saweria"

### Native Path Rewrites (src/routes/proxy/overlay.js)

Internal rewrites (not redirects) that fall through to the `/overlay` handler:

- `/alertbox/:key` → BagiBagi
- `/widgets/:type?streamKey=` → Saweria
- `/overlay/:type?overlay_key=` → Tako
- `/pro/tribe/alert1/v3/:key?...` → Sociabuzz alert (preserves extra params)
- `/pro/tribe/mediashare/v2/:key?...` → Sociabuzz mediashare (preserves extra params)

## Adding a New Platform

### 1. src/platforms.js

```js
myplatform: {
  name: "MyPlatform",
  streamKeyParam: "key",
  overlays: ["alert", "mediashare"],
  overlayUrl: ({ streamKey, overlayType, extraParams }) => `https://...`,
  assetOrigin: "https://myplatform.com",
  backendOrigin: "https://myplatform.com/api",
  backendPathPrefix: "/api",           // null if backend is on different origin
  useImpersonate: false,               // true if Cloudflare protected
  forwardHeaders: [],                  // dynamic headers to forward
  backendHeaders: ({ streamKey, overlayType }) => ({...}),
  assetHeaders: () => ({...}),
}
```

### 2. client/wsProtocol/myplatform.js

```js
export function parse(raw) {
  // Parse raw WS string → return [{donator, message, amount, currency}] or null
}

export function modify(raw, replacement) {
  // Modify raw WS string using replacement.replaceDonator / replacement.replaceMessage
  // Also null/delete TTS fields
  // Return modified string
}
```

Then register it in `client/inject.js`:

```js
import * as myplatform from "./wsProtocol/myplatform.js";
const wsProtocol = { saweria, bagibagi, sociabuzz, myplatform };
```

For fetch-based platforms (like Tako), export `detectDonationSignal`, `parseFetchBody`, `modifyFetchBody` instead and wire them into the fetch hook.

### 3. src/routes/proxy/overlay.js — Native path rewrite

```js
router.get("/myplatform/overlay/:key", (req, res, next) => {
  req.query = { ...req.query, platform: "myplatform", streamKey: req.params.key };
  req.url = "/overlay?" + new URLSearchParams(req.query).toString();
  next();
});
```

### 4. public/index.html — URL converter pattern

```js
{ match: /^https?:\/\/myplatform\.com\/overlay\/([^?]+)/, build: (m) => `platform=myplatform&streamKey=${m[1]}` },
```

### 5. tests/client/wsProtocol.test.js — Add fixture tests

```js
import * as myplatform from "../../client/wsProtocol/myplatform.js";
// parse a donation fixture, assert donor/message/amount/currency
// modify and assert TTS field is nulled/deleted, replaceDonator/Message applied
```

## Environment Variables

Single source of truth: **`.env` at the repo root** (template in `.env.example`). Every variable is namespaced by service so a glance at any line tells you which service it belongs to. The shared `ENVIRONMENT` knob is the only un-prefixed var — it controls debug/reload/log defaults across all services.

### Shared

| Variable      | Default       | Description                                                    |
| ------------- | ------------- | -------------------------------------------------------------- |
| `ENVIRONMENT` | `development` | `development` \| `production` — drives debug/reload, log defaults |

### Proxy (`PROXY_*`)

| Variable                       | Default                   | Description                                                   |
| ------------------------------ | ------------------------- | ------------------------------------------------------------- |
| `PROXY_HOST`                   | `0.0.0.0`                 | Bind address                                                  |
| `PROXY_PORT`                   | `3000`                    | Port                                                          |
| `PROXY_LOG_LEVEL`              | —                         | `debug` \| `info` \| `warn` \| `error` (default: debug in dev, info in prod) |
| `PROXY_KILL_SWITCH_PATH`       | `.killswitch`             | When this file exists, `/check` allows everything             |
| `PROXY_KILL_SWITCH_TTL_MS`     | `2000`                    | How long a kill-switch existence check is cached              |
| `PROXY_FILTER_METHOD`          | `algorithm`               | `algorithm` \| `classifier` \| `both` — which filter(s) to consult |
| `PROXY_FILTER_URL`             | `http://localhost:9000`   | Filter service URL (used when `FILTER_METHOD=classifier`)     |
| `PROXY_FILTER_TIMEOUT_MS`      | `5000`                    | Classifier HTTP request timeout                               |
| `PROXY_MAX_FIELD_LENGTH`       | `4096`                    | Max chars per body field on `/check` and `/feedback`          |
| `PROXY_JSON_BODY_LIMIT`        | `64kb`                    | Express body parser limit                                     |
| `PROXY_FEEDBACK_RATE_WINDOW_MS`| `60000`                   | `/feedback` rate-limit window                                 |
| `PROXY_FEEDBACK_RATE_MAX`      | `30`                      | `/feedback` requests per window per IP                        |
| `PROXY_BLOCK_DONATOR`          | `Anonymous`               | Donor name replacement on block                               |
| `PROXY_BLOCK_MESSAGE`          | (Indonesian default)      | Message replacement on block                                  |
| `PROXY_DEFAULT_PLATFORM`       | `saweria`                 | Asset-proxy fallback when no cookie/referer is present        |

### Filter (`FILTER_*`)

pydantic-settings reads these with `env_prefix="FILTER_"`, so internally the code reads `settings.HOST`, `settings.PORT`, etc.

| Variable                  | Default     | Description                                  |
| ------------------------- | ----------- | -------------------------------------------- |
| `FILTER_HOST`             | `127.0.0.1` | Bind address                                 |
| `FILTER_PORT`             | `9000`      | Port (internal-only in Docker; not published) |
| `FILTER_LOG_LEVEL`        | `INFO`      | DEBUG / INFO / WARNING / ERROR / CRITICAL    |
| `FILTER_CORS_ORIGINS`     | `["*"]`     | CORS allow-list (JSON list)                  |
| `FILTER_MODEL_BATCH_SIZE` | `32`        | Tokenizer/model batch size                   |
| `FILTER_MODEL_MAX_LENGTH` | `512`       | Tokenizer max sequence length                |

`APP_NAME`/`APP_VERSION` are intentionally hardcoded in `app/config/settings.py` — not env-driven (they identify the build, not the deployment).

### How the file is loaded

- **Bun (proxy)**: package scripts pass `--env-file=../../.env` to bun.
- **Pydantic (filter)**: `settings.py` resolves the root `.env` via `Path(__file__).resolve().parents[3]`.
- **Docker Compose**: auto-loads root `.env` for `${VAR}` substitution; each service's `environment:` block forwards only the vars it cares about.

Defaults are sane — **`.env` is optional**. If you want overrides, `cp .env.example .env` and tweak.

No credentials required — the cuimp binary auto-downloads to `~/.cuimp/binaries/` on first use and is pre-warmed on startup by `services/proxy/src/server.js`.

## Common Issues & Solutions

**Cloudflare blocks the overlay HTML:** Confirm `platform.useImpersonate: true` for that platform. Watch the `[impersonate] cmd …` debug log — it should include `--impersonate chrome116 --compressed`; without either flag, CF will block (plain curl) or return gibberish (undecompressed gzip/br).

**Cuimp re-downloads on every boot (Windows):** Already worked around in `src/antibot/impersonate.js` — we capture `downloadBinary().binaryPath` and pass it as `path` to `createCuimpHttp`, skipping cuimp's buggy Windows binary lookup. Don't re-introduce `descriptor.version` unless you also fix the lookup upstream.

**Rocket Loader mangles scripts:** `cfStrip.stripCloudflareArtifacts` (called from `src/routes/proxy/overlay.js`) strips CF scripts and fixes `type` attribute prefixes (e.g. `abc123-module` → `module`).

**TTS audio returns gibberish:** Binary response got UTF-8 decoded somewhere. `impersonate.js` returns both `data` (utf8 string) and `rawBody` (Buffer); `backend.js` must use `rawBody` for the `res.send()` — never decode then re-encode audio.

**SignalR `\x1e` separator:** BagiBagi uses SignalR which appends `\x1e` to WS messages. `client/wsProtocol/bagibagi.js` strips it before `JSON.parse` and re-appends on output.

**TTS still playing after block:** Ensure the platform's `modify` in `client/wsProtocol/{platform}.js` nulls/deletes all TTS-related fields. Sociabuzz requires `m.data = JSON.stringify(x)` after modifying the inner object.

**Stale platform cookie:** `/overlay` route sets `Set-Cookie` via HTTP header. Native path rewrites are internal (not redirects) to avoid losing the cookie.

**Framework hydration mismatch:** `history.replaceState` sets the browser URL to match the platform's expected path. Native path rewrite routes handle refreshes.

**Tako gift replay on refresh:** Normal behavior — unfinished gifts replay until PUT with `x-played-gift-ids`. The `forwardHeaders` config ensures this header is proxied.

**Sociabuzz query params lost on refresh:** Native path rewrites use `{ ...req.query, ... }` to preserve extra styling params.

**Consecutive blocked donations affecting next donation:** Source-level data modification (not DOM) ensures each donation is independently processed. No stale state between donations.

**Edited `client/` but changes don't take effect:** You forgot to rebuild the bundle. `bun dev`/`start`/`test` all run `build:inject` automatically — if you're loading `public/inject.js` by some other means, run `bun run build:inject` manually.

## Testing & Running

All Bun commands run from `services/proxy/`. Docker commands run from the repo root.

```bash
cd services/proxy

# Full suite — rebuilds inject bundle first, then runs filter + normalizeText + typoMatcher + wsProtocol tests
bun test

# Start server (also rebuilds bundle)
bun dev

# Regenerate homoglyph fold table after editing scripts/charset.json
bun scripts/build-homoglyphs.js

# Rebuild only the client bundle (normally handled by dev/start/test)
bun run build:inject
```

Docker workflow (from repo root):

```bash
docker compose up --build           # build and start
docker compose logs -f proxy        # tail logs
docker compose exec proxy touch /app/.killswitch   # activate kill switch
docker compose exec proxy rm /app/.killswitch      # deactivate
docker compose down                 # stop
```

Exercise endpoints (same regardless of launch method):

```bash
curl http://localhost:3000/overlay?platform=saweria&overlayType=alert&streamKey=TEST_KEY
curl -X POST http://localhost:3000/check -H "Content-Type: application/json" \
  -d '{"platform":"saweria","donator":"test","message":"slot gacor","amount":1000,"currency":"IDR"}'
```

Test coverage:

- `tests/judolFilter.test.js` — end-to-end decide() coverage across block/allow/review cases, including brand variants, leet, vowel drops, typos, and bypass attempts
- `tests/normalizeText.test.js` — fullwidth/math/enclosed alphabets, diacritics, zero-width chars, emoji, ligatures, homoglyphs, and data-driven coverage across every map in `scripts/charset.json`
- `tests/typoMatcher.test.js` — dictionary fuzzy matching, sensitive-term matching, canonicalization
- `tests/client/wsProtocol.test.js` — per-platform parse + modify, TTS field handling, protocol-specific quirks (SignalR framing, nested JSON, fetch-body shape)
