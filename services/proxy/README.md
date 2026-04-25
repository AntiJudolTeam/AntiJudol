# AntiJudol — Proxy Service

Bun/Express proxy that fronts streaming donation overlay widgets, intercepts donation traffic in the browser, and rewrites or blocks gambling-promotion content before it reaches the streamer's overlay.

For the project overview, supported platforms, and Docker setup, see the [root README](../../README.md). For the architectural deep-dive, see [`AGENTS.md`](../../AGENTS.md).

## Layout

```
src/
  server.js           Express bootstrap — validates config, pre-warms cuimp
  config.js           Env-driven runtime config + validateConfig()
  constants.js        Wire-protocol constants shared with the browser bundle
  platforms.js        Per-platform configuration registry
  routes/
    api/
      check.js        POST /check — donation verdict
      feedback.js     POST /feedback — user-reported false positives
    proxy/
      overlay.js      GET /overlay — HTML proxy + script injection
      backend.js      /backend/:platform/* — API proxy
      assets.js       Catch-all static asset proxy
    web/
      static.js       express.static(public/)
  antibot/
    impersonate.js    cuimp (curl-impersonate) client + cookie jar
  filter/
    judolFilter.js    Built-in pattern decision logic (`decide()`)
    classifier.js     HTTP client for the FastAPI filter service
    normalizeText.js  Homoglyph / leet / decoration normalisation
    typoMatcher.js    Fuzzy Indonesian dictionary matcher
    textUtils.js      Shared regexes + levenshtein
    wordlist.js       Loads data/wordlist-indonesia.txt
    homoglyphs.js     AUTO-GENERATED fold table
  utils/
    cfStrip.js        Strip Cloudflare Rocket Loader artefacts
    donationLog.js    Per-donation decision log
    feedbackLog.js    User-feedback log
    helpers.js        Cookie/referer extractors + script injection
    killSwitch.js     File-existence kill switch with TTL cache
    logFile.js        Shared log-file utilities (paths, rotation, sanitise)
    logger.js         Tagged leveled logger
    paths.js          Project-root path constants
    platformMiddleware.js  resolvePlatform() Express middleware
    rateLimit.js      In-memory rate limiter
    validation.js     Request-body coercion (asString/asNumberOrNull)
client/               Browser-side source (bundled → public/inject.js)
  inject.js           WS/fetch/XHR hooks + sync /check call
  wsProtocol/         Per-platform parse/modify modules
public/               HTTP-served static files (index.html, validate.html, icons, bundled inject.js)
data/
  blocklist.js        Brand names, strong/weak patterns, leet maps
  wordlist-indonesia.txt
scripts/
  build-homoglyphs.js Regenerate src/filter/homoglyphs.js from charset.json
tests/                Bun test suite
```

## Common commands

```bash
bun install
bun dev                  # rebuild client bundle + watch mode (algorithm filter, no Python)
bun start                # production mode
bun test                 # run all tests (rebuilds bundle first)
bun run build:inject     # rebuild client/inject.js → public/inject.js
bun run build:homoglyphs # regenerate homoglyphs fold table
bun run lint
bun run format
```

## Configuration

All settings are env-driven. See the [root `.env.example`](../../.env.example) for the canonical list. Common overrides:

| Variable                | Default                  | Effect                                    |
| ----------------------- | ------------------------ | ----------------------------------------- |
| `PROXY_PORT`            | `3000`                   | Public bind port                          |
| `PROXY_LOG_LEVEL`       | debug (dev) / info (prod) | Console verbosity                         |
| `PROXY_FILTER_METHOD`   | `algorithm`              | `algorithm` or `classifier`               |
| `PROXY_FILTER_URL`      | `http://localhost:9000`  | Used when `FILTER_METHOD=classifier`      |
| `PROXY_FILTER_TIMEOUT_MS` | `5000`                 | Classifier request timeout                |
| `PROXY_BLOCK_MESSAGE`   | (Indonesian default)     | Text replacing blocked donations          |
| `PROXY_BLOCK_DONATOR`   | `Anonymous`              | Donor name replacement                    |
| `PROXY_KILL_SWITCH_PATH` | `.killswitch`           | Touch this file to bypass filtering       |

## Adding a Platform

See the matching section in [`AGENTS.md`](../../AGENTS.md#adding-a-new-platform).
