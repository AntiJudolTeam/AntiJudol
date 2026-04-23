# AntiJudol

Proxy server that instruments streaming donation overlay widgets to intercept, inspect, and filter messages in real-time. Built to combat gambling promotion ("judol") in Indonesian live-streaming donation overlays.

## Supported Platforms

| Platform                           | Alert | Mediashare | CF Bypass         |
| ---------------------------------- | ----- | ---------- | ----------------- |
| [Saweria](https://saweria.co)      | Yes   | Yes        | —                 |
| [Tako](https://tako.id)            | Yes   | Yes        | —                 |
| [BagiBagi](https://bagibagi.co)    | Yes   | Yes        | curl-impersonate  |
| [Sociabuzz](https://sociabuzz.com) | Yes   | Yes        | —                 |

## How It Works

1. Proxies the overlay HTML and injects interception hooks
2. Hooks WebSocket, fetch, and XHR to intercept donation data
3. Checks each donation against the judol filter via a synchronous `/check` call
4. Blocked donations have their donator name, message, and TTS audio replaced/removed at the data source — before the overlay renders

## Setup

Requires [Bun](https://bun.com/) (1.2+).

```bash
bun install
cp .env.example .env   # edit if you need to override defaults
bun dev                # or: bun start
```

`bun dev` / `bun start` automatically bundle the client-side injection script (`client/inject.js` → `public/inject.js`) before booting the server.

On first boot, the `impersonate` layer auto-downloads the `curl-impersonate` binary into `~/.cuimp/binaries/` — no Docker, no external service.

## Usage

1. Open `http://localhost:3000`
2. Paste your overlay URL
3. Copy the generated AntiJudol URL
4. Use it as a Browser Source in OBS

### Example URLs

```
# Saweria
http://localhost:3000/overlay?platform=saweria&overlayType=alert&streamKey=YOUR_KEY

# Tako
http://localhost:3000/overlay?platform=tako&overlayType=alert&streamKey=YOUR_KEY

# BagiBagi
http://localhost:3000/overlay?platform=bagibagi&streamKey=YOUR_KEY

# Sociabuzz
http://localhost:3000/overlay?platform=sociabuzz&overlayType=alert&streamKey=YOUR_KEY
```

## Configuration

### Environment Variables

| Variable           | Default       | Description                                  |
| ------------------ | ------------- | -------------------------------------------- |
| `ENVIRONMENT`      | `development` | `development` \| `production`                |
| `HOST`             | `0.0.0.0`     | Server bind address                          |
| `PORT`             | `3000`        | Server port                                  |
| `LOG_LEVEL`        | —             | `debug` \| `info` \| `warn` \| `error`       |
| `KILL_SWITCH_PATH` | `.killswitch` | Touch this file to bypass filtering          |

### Filter

Blocklists live in `data/blocklist.js` (brands, strong/weak patterns, suspicious-name heuristics, leet map). Decision logic is in `src/filter/judolFilter.js`. The homoglyph fold table in `src/filter/homoglyphs.js` is generated from `scripts/charset.json`:

```bash
bun scripts/build-homoglyphs.js
```

When blocked:

- Donator name → `"Anonymous"` (`src/constants.js`)
- Message → `"[Message has been blocked by AntiJudol]"` (`src/constants.js`)
- TTS audio → removed/nulled (no audio playback for blocked donations)

### Kill Switch

Create the file pointed to by `KILL_SWITCH_PATH` to force `/check` to return `allow` for every request — useful if the filter misbehaves during a live stream. Remove the file to re-arm.

## Adding a Platform

### 1. Platform config (`src/platforms.js`)

```js
myplatform: {
  name: "MyPlatform",
  streamKeyParam: "key",
  overlays: ["alert", "mediashare"],
  overlayUrl: ({ streamKey, overlayType }) => `https://example.com/overlay/${overlayType}?key=${streamKey}`,
  assetOrigin: "https://example.com",
  backendOrigin: "https://example.com/api",
  backendPathPrefix: "/api",       // null if backend is on a different origin
  useImpersonate: false,           // true for Cloudflare-protected sites
  forwardHeaders: [],              // dynamic headers to forward from browser
  backendHeaders: ({ streamKey }) => ({ ... }),
  assetHeaders: () => ({ ... }),
}
```

### 2. Donation parser + modifier (`client/wsProtocol/myplatform.js`)

```js
// parse: extract donation fields from raw WS data
export function parse(raw) {
  // Return [{donator, message, amount, currency}] or null
}

// modify: rewrite raw WS data with blocked replacements
export function modify(raw, replacement) {
  // Apply replacement.replaceDonator / replacement.replaceMessage, null TTS fields
  // Return modified raw string
}
```

Then register the module in `client/inject.js`:

```js
import * as myplatform from "./wsProtocol/myplatform.js";
const wsProtocol = { saweria, bagibagi, sociabuzz, myplatform };
```

### 3. Native path rewrite (`src/routes/proxy/overlay.js`)

```js
router.get("/myplatform/overlay/:key", (req, res, next) => {
  req.query = { ...req.query, platform: "myplatform", streamKey: req.params.key };
  req.url = "/overlay?" + new URLSearchParams(req.query).toString();
  next();
});
```

### 4. URL converter (`public/index.html`)

```js
{ match: /^https?:\/\/myplatform\.com\/overlay\/([^?]+)/, build: (m) => `platform=myplatform&streamKey=${m[1]}` },
```

## Project Structure

```
src/                          Server-side code
  server.js                   Entry point — validates config, pre-downloads impersonate binary, starts Express
  config.js                   Environment-driven config
  constants.js                Wire-protocol constants
  platforms.js                Platform configurations
  routes/
    index.js                  Route aggregator + JSON body parser
    api/check.js              POST /check — donation filter endpoint
    proxy/overlay.js          GET /overlay — HTML proxy + script injection + native path rewrites
    proxy/backend.js          /backend/:platform/* — API proxy
    proxy/assets.js           Catch-all — static asset proxy
    web/static.js             express.static over public/
  antibot/
    index.js                  Thin facade — forwards to impersonate
    impersonate.js            cuimp (curl-impersonate) client
  filter/
    judolFilter.js            Decision logic (decide())
    normalizeText.js          Text normalization (homoglyph fold, leet strip, etc.)
    typoMatcher.js            Fuzzy dictionary + sensitive-term matcher
    wordlist.js               Loads data/wordlist-indonesia.txt
    homoglyphs.js             Auto-generated fold table (do not hand-edit)
  utils/
    cfStrip.js                Strip Cloudflare script artifacts from overlay HTML
    donationLog.js            Per-donation decision log
    helpers.js                Cookie/referer helpers, script injection
    killSwitch.js             Checks KILL_SWITCH_PATH existence
    logger.js                 Leveled console logger
    platformMiddleware.js     resolvePlatform — query/cookie/referer → platform

client/                       Browser-side source (bundled → public/inject.js)
  inject.js                   WS/fetch/XHR hooks + donation filtering
  wsProtocol/                 Per-platform parse/modify modules (saweria, bagibagi, sociabuzz, tako)

public/                       HTTP-served static files
  inject.js                   Build output — bundled from client/inject.js
  index.html                  Web UI — overlay URL converter

data/
  blocklist.js                Brand names, strong/weak patterns, leet map
  wordlist-indonesia.txt      Dictionary for fuzzy typo detection

scripts/
  build-homoglyphs.js         Regenerate src/filter/homoglyphs.js from charset.json
  charset.json                Upstream homoglyph dataset (source of truth)

tests/                        Bun test suite (filter, normalizeText, typoMatcher, wsProtocol)
```

## Tech Stack

- **Bun** — runtime + bundler (`bun build` produces `public/inject.js` from `client/`)
- **Express** — HTTP proxy server
- **[cuimp](https://www.npmjs.com/package/cuimp)** — Node wrapper around `curl-impersonate` for Cloudflare bypass
- **[curl-impersonate](https://github.com/lexiforest/curl-impersonate)** (lexiforest fork) — TLS/HTTP fingerprint spoofing

## Authors

Made by [AntiJudol Team](https://github.com/AntiJudolTeam)
