// All runtime configuration. Each value reads an env var with a sensible default;
// validateConfig() runs once at startup and rejects nonsense.

const env = process.env;

const VALID_LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const VALID_FILTER_METHODS = new Set(["algorithm", "classifier"]);

function readInt(name, fallback) {
  const raw = env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function readEnum(name, allowed, fallback) {
  const raw = env[name];
  if (!raw) return fallback;
  return allowed.has(raw) ? raw : fallback;
}

// --- Environment -------------------------------------------------------------

export const ENVIRONMENT = env.ENVIRONMENT || "development";
export const IS_DEV = ENVIRONMENT !== "production";

// --- Server ------------------------------------------------------------------

export const HOST = env.PROXY_HOST || "0.0.0.0";
export const PORT = readInt("PROXY_PORT", 3000);

export const LOG_LEVEL = readEnum("PROXY_LOG_LEVEL", VALID_LOG_LEVELS, IS_DEV ? "debug" : "info");

// --- Kill switch -------------------------------------------------------------

export const KILL_SWITCH_PATH = env.PROXY_KILL_SWITCH_PATH || ".killswitch";
export const KILL_SWITCH_TTL_MS = readInt("PROXY_KILL_SWITCH_TTL_MS", 2000);

// --- Filter routing ----------------------------------------------------------

export const FILTER_METHOD = env.PROXY_FILTER_METHOD || "algorithm";
export const FILTER_URL = env.PROXY_FILTER_URL || "http://localhost:9000";
export const FILTER_TIMEOUT_MS = readInt("PROXY_FILTER_TIMEOUT_MS", 5000);

// --- Request validation ------------------------------------------------------

export const MAX_FIELD_LENGTH = readInt("PROXY_MAX_FIELD_LENGTH", 4096);
export const JSON_BODY_LIMIT = env.PROXY_JSON_BODY_LIMIT || "64kb";

// --- Rate limiting -----------------------------------------------------------

export const FEEDBACK_RATE_WINDOW_MS = readInt("PROXY_FEEDBACK_RATE_WINDOW_MS", 60_000);
export const FEEDBACK_RATE_MAX = readInt("PROXY_FEEDBACK_RATE_MAX", 30);

// --- Block replacements ------------------------------------------------------

export const BLOCK_DONATOR_REPLACEMENT = env.PROXY_BLOCK_DONATOR || "Anonymous";
export const BLOCK_MESSAGE_REPLACEMENT =
  env.PROXY_BLOCK_MESSAGE ||
  "Pesan ini telah diblokir oleh AntiJudol. Lakukan verifikasi lebih lanjut pada platform anda.";

// --- Asset proxy -------------------------------------------------------------

export const DEFAULT_PLATFORM = env.PROXY_DEFAULT_PLATFORM || "saweria";

// --- Validation --------------------------------------------------------------

export function validateConfig() {
  if (!VALID_FILTER_METHODS.has(FILTER_METHOD)) {
    throw new Error(
      `PROXY_FILTER_METHOD must be one of [${[...VALID_FILTER_METHODS].join(", ")}], got "${FILTER_METHOD}"`
    );
  }
  if (FILTER_METHOD === "classifier") {
    try {
      // Throws on nonsense URLs — fail at startup, not at first request.
      new URL(FILTER_URL);
    } catch {
      throw new Error(`PROXY_FILTER_URL is not a valid URL: "${FILTER_URL}"`);
    }
  }
}
