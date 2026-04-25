import fs from "node:fs";
import { KILL_SWITCH_PATH, KILL_SWITCH_TTL_MS } from "../config.js";
import { resolveFromRoot } from "./paths.js";
import { logger } from "./logger.js";

const resolvedPath = resolveFromRoot(KILL_SWITCH_PATH);

let cached = fs.existsSync(resolvedPath);
let checkedAt = Date.now();

logger.info("kill-switch", cached ? `ACTIVE (${resolvedPath})` : `inactive (${resolvedPath})`);

export function isKillSwitchActive() {
  const now = Date.now();
  if (now - checkedAt < KILL_SWITCH_TTL_MS) return cached;
  checkedAt = now;
  const present = fs.existsSync(resolvedPath);
  if (present !== cached) {
    cached = present;
    logger.info("kill-switch", present ? "ACTIVE" : "inactive");
  }
  return cached;
}
