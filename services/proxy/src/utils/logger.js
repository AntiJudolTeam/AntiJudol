import { LOG_LEVEL } from "../config.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function emit(level, console_fn, tag, args) {
  if (LEVELS[level] < threshold) return;
  if (tag) console_fn(`[${tag}]`, ...args);
  else console_fn(...args);
}

export const logger = {
  debug: (tag, ...args) => emit("debug", console.log, tag, args),
  info: (tag, ...args) => emit("info", console.log, tag, args),
  warn: (tag, ...args) => emit("warn", console.warn, tag, args),
  error: (tag, ...args) => emit("error", console.error, tag, args),
};
