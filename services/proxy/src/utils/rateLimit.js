import { logger } from "./logger.js";

export function createRateLimiter({ windowMs, max, name = "rate-limit" }) {
  const hits = new Map();

  const cleanupInterval = Math.max(windowMs, 60_000);
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, cleanupInterval);
  if (typeof timer.unref === "function") timer.unref();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      logger.warn(name, "429", key, `${entry.count}/${max}`);
      return res.status(429).json({ error: "Too many requests", retryAfter });
    }

    next();
  };
}
