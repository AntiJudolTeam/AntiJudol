import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KILL_SWITCH_PATH } from "../config.js";
import { logger } from "./logger.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const resolvedPath = path.isAbsolute(KILL_SWITCH_PATH) ? KILL_SWITCH_PATH : path.resolve(PROJECT_ROOT, KILL_SWITCH_PATH);

const TTL_MS = 2000;

let cached = fs.existsSync(resolvedPath);
let checkedAt = Date.now();

logger.info("kill-switch", cached ? `ACTIVE (${resolvedPath})` : `inactive (${resolvedPath})`);

export function isKillSwitchActive() {
  const now = Date.now();
  if (now - checkedAt < TTL_MS) return cached;
  checkedAt = now;
  const present = fs.existsSync(resolvedPath);
  if (present !== cached) {
    cached = present;
    logger.info("kill-switch", present ? "ACTIVE" : "inactive");
  }
  return cached;
}
