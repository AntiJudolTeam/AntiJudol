import { appendLogLine, dailyLogPath, sanitizeForLog, timeString } from "./logFile.js";

const NEAR_MISS_THRESHOLD = 3;
const TRUNCATE_DEFAULT = 80;

function truncate(text, max = TRUNCATE_DEFAULT) {
  if (!text) return "";
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function parseScore(reason) {
  const m = /score=(-?\d+(?:\.\d+)?)/.exec(reason ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

// Render integer scores as-is, floats trimmed to ≤2 decimals with trailing zeros stripped.
function formatScore(score) {
  if (score == null) return "?";
  if (Number.isInteger(score)) return String(score);
  return Number(score.toFixed(2)).toString();
}

function parseField(reason, name) {
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
  const m = re.exec(reason ?? "");
  return m ? m[1].trim() : "";
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
    const tail = brands
      ? `brands=${brands}`
      : strong
        ? `strong=${strong}`
        : suspicious
          ? `suspicious=${suspicious}`
          : "";
    return `[block:${stage} score=${formatScore(score)}${tail ? " " + truncate(tail) : ""}]`;
  }

  const ctx = parseField(reason, "allowContext");

  if (score !== null && score >= NEAR_MISS_THRESHOLD) {
    return ctx ? `[allow:near score=${formatScore(score)} ctx=${truncate(ctx, 40)}]` : `[allow:near score=${formatScore(score)}]`;
  }
  if (stage === "allow-context" && ctx) {
    return `[allow:ctx ${truncate(ctx, 60)}]`;
  }
  return "[allow]";
}

export function logDonation({ donator, message, decision = null, killed = false }) {
  const marker = formatMarker(decision, killed);
  const line = `[${timeString()}] ${marker} ${sanitizeForLog(donator)}: ${sanitizeForLog(message)}`;
  appendLogLine(dailyLogPath(), line);
}
