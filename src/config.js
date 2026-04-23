const env = process.env;

function asInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const ENVIRONMENT = env.ENVIRONMENT || "development";
export const IS_DEV = ENVIRONMENT !== "production";

export const HOST = env.HOST || "0.0.0.0";
export const PORT = asInt(env.PORT, 3000);

export const LOG_LEVEL = env.LOG_LEVEL || (IS_DEV ? "debug" : "info");

export const KILL_SWITCH_PATH = env.KILL_SWITCH_PATH || ".killswitch";

export function validateConfig() {
  // No config currently needs cross-field validation. Kept as a hook.
}
