import fs from "node:fs";
import path from "node:path";
import { LOG_DIR } from "./paths.js";

const ensuredDirs = new Set();

function ensureDir(dir) {
  if (ensuredDirs.has(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  ensuredDirs.add(dir);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function timeString(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function dateStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dailyLogPath(prefix = "") {
  const name = prefix ? `${prefix}-${dateStamp()}.txt` : `${dateStamp()}.txt`;
  return path.join(LOG_DIR, name);
}

export function sanitizeForLog(text) {
  return String(text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

export function appendLogLine(filePath, line) {
  try {
    ensureDir(path.dirname(filePath));
    fs.appendFile(filePath, line.endsWith("\n") ? line : line + "\n", () => {});
  } catch {
    /* best-effort logging */
  }
}
