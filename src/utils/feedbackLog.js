import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, "../..", "logs");

let dirReady = false;

function ensureDir() {
  if (dirReady) return;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  dirReady = true;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayFile() {
  const d = new Date();
  return path.join(LOG_DIR, `feedback-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.txt`);
}

function timeString() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function sanitize(text) {
  return String(text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
}

export function logFeedback({ donator, message, decision, verdict }) {
  try {
    ensureDir();
    const line = `[${timeString()}] [${decision}] [${verdict}] ${sanitize(donator)} :: ${sanitize(message)}\n`;
    fs.appendFile(todayFile(), line, () => {});
  } catch {
    /* best-effort logging */
  }
}
