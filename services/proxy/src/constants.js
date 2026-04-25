// Wire-protocol constants — shared with browser-side inject.js. Changing any of
// these without updating both sides breaks the overlay. Operator-facing values
// (block messages, ports, log levels) live in src/config.js instead.

export const COOKIE_PLATFORM = "antijudol_platform";

export const CHECK_ENDPOINT = "/check";
export const FEEDBACK_ENDPOINT = "/feedback";
export const BACKEND_PREFIX = "/backend";

export const GLOBAL_CONFIG_KEY = "__ANTIJUDOL__";

// Refresh periodically — some platforms gate on Sec-CH-UA being recent.
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export const BROWSER_HEADERS = Object.freeze({
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "dnt": "1",
  "pragma": "no-cache",
  "priority": "u=1, i",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent": USER_AGENT,
});

export const MIME_TYPES = Object.freeze({
  json: "application/json",
  js: "application/javascript",
  css: "text/css",
  html: "text/html",
  svg: "image/svg+xml",
  txt: "text/plain",
  xml: "application/xml",
});

export const TEXT_ASSET_EXTENSIONS = Object.freeze(Object.keys(MIME_TYPES));
