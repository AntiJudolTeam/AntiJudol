import { logger } from "../utils/logger.js";
import { normalizeText } from "./normalizeText.js";
import { FILTER_TIMEOUT_MS } from "../config.js";

const CLASSIFIER_PATH = "/api/v1/classify/predict";

// Read the URL lazily so tests can override PROXY_FILTER_URL after module-load.
function getFilterUrl() {
  return process.env.PROXY_FILTER_URL || "http://localhost:9000";
}

const SEPARATOR_RE = /[|/\\[\]{}<>*_~`]+/g;
const MULTI_SPACE_RE = /\s+/g;

function normalizeForClassifier(donator, message) {
  const raw = [donator, message].filter(Boolean).join(" ").trim();
  if (!raw) return "";
  const variants = normalizeText(raw).filter(Boolean);
  const base = variants[0] || raw.toLowerCase();
  return base.replace(SEPARATOR_RE, " ").replace(MULTI_SPACE_RE, " ").trim();
}

export async function classify(donator, message) {
  const text = normalizeForClassifier(donator, message);
  if (!text) {
    logger.debug("classifier", "empty input — skipping HTTP call");
    return { action: "allow", stage: "classifier", reason: "empty-input" };
  }

  const url = `${getFilterUrl()}${CLASSIFIER_PATH}`;
  logger.debug("classifier", "→ POST", url, JSON.stringify({ text }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FILTER_TIMEOUT_MS);

  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  logger.debug("classifier", `← ${res.status} in ${Date.now() - t0}ms`);

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "<unreadable>");
    logger.warn("classifier", `non-200: ${res.status}`, bodyPreview.slice(0, 500));
    throw new Error(`classifier returned ${res.status}`);
  }

  const json = await res.json();

  if (!json || json.status !== true || !json.data) {
    throw new Error("classifier response missing status/data");
  }

  const { label, gambling } = json.data;
  if (label !== 0 && label !== 1) {
    throw new Error(`classifier returned invalid label: ${label}`);
  }

  const score = typeof gambling === "number" ? gambling.toFixed(4) : "?";
  return {
    action: label === 1 ? "block" : "allow",
    stage: "classifier",
    reason: `score=${score}`,
  };
}
