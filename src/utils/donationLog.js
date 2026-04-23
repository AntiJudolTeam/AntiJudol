import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, "../..", "logs");

const NEAR_MISS_THRESHOLD = 3;

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
  return path.join(LOG_DIR, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.txt`);
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

function parseScore(reason) {
  const m = /score=(-?\d+)/.exec(reason ?? "");
  return m ? parseInt(m[1], 10) : null;
}

function parseField(reason, name) {
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  const m = re.exec(reason ?? "");
  return m ? m[1].trim() : "";
}

function truncate(text, max = 80) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function formatMarker(decision, killed) {
  if (killed) return "[killed]";
  if (!decision) return "[allow]";

  const { action, stage, reason } = decision;
  const score = parseScore(reason);

  if (action === "block") {
    if (stage === "brand") {
      return `[block:brand ${truncate(parseField(reason, "brands"))}]`;
    }
    const strong = parseField(reason, "strong");
    const brands = parseField(reason, "brands");
    const suspicious = parseField(reason, "suspicious");
    const tail = brands ? `brands=${brands}` : strong ? `strong=${strong}` : suspicious ? `suspicious=${suspicious}` : "";
    return `[block:${stage} score=${score ?? "?"}${tail ? " " + truncate(tail) : ""}]`;
  }

  const ctx = parseField(reason, "allowContext");

  if (score !== null && score >= NEAR_MISS_THRESHOLD) {
    return ctx ? `[allow:near score=${score} ctx=${truncate(ctx, 40)}]` : `[allow:near score=${score}]`;
  }
  if (stage === "allow-context" && ctx) {
    return `[allow:ctx ${truncate(ctx, 60)}]`;
  }
  return "[allow]";
}

export function logDonation({ donator, message, decision = null, killed = false }) {
  try {
    ensureDir();
    const marker = formatMarker(decision, killed);
    const line = `[${timeString()}] ${marker} ${sanitize(donator)}: ${sanitize(message)}\n`;
    fs.appendFile(todayFile(), line, () => {});
  } catch {}
}
