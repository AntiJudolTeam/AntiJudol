import { normalizeText } from "./normalizeText.js";
import { loadWordlist, buildWordlistIndex, SENSITIVE_TERMS } from "./wordlist.js";
import { foldLeet, tightenIntraWord as tighten, levenshtein } from "./textUtils.js";

const LEET_MAP_I = Object.freeze({
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i",
});
const LEET_MAP_L = Object.freeze({
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "l",
});

export function normalize(text) {
  const bases = normalizeText(String(text ?? ""));
  if (bases.length === 0 || !bases[0]) return "";
  return tighten(foldLeet(bases[0], LEET_MAP_I));
}

export function normalizeVariants(text) {
  const bases = normalizeText(String(text ?? ""));
  const out = new Set();
  for (const base of bases) {
    if (!base) continue;
    out.add(base);
    const t = tighten(base);
    if (t) out.add(t);
    const i = foldLeet(base, LEET_MAP_I);
    if (i) out.add(i);
    const l = foldLeet(base, LEET_MAP_L);
    if (l) out.add(l);
    const ti = tighten(i);
    if (ti) out.add(ti);
    const tl = tighten(l);
    if (tl) out.add(tl);
  }
  out.delete("");
  return [...out];
}

function lcpLen(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function isBetter(prev, candDist, candMatch, token) {
  if (!prev) return true;
  if (candDist < prev.dist) return true;
  if (candDist > prev.dist) return false;
  const candLcp = lcpLen(candMatch, token);
  const prevLcp = lcpLen(prev.match, token);
  if (candLcp > prevLcp) return true;
  if (candLcp < prevLcp) return false;
  return candMatch.length > prev.match.length;
}

function fuzzyScanSet(token, set, max) {
  let best = null;
  for (const w of set) {
    if (Math.abs(w.length - token.length) > max) continue;
    const d = levenshtein(token, w, max);
    if (d <= max && isBetter(best, d, w, token)) {
      best = { match: w, dist: d };
      if (d === 0) return best;
    }
  }
  return best;
}

function fuzzyScanIndex(token, index, max) {
  if (!token) return null;
  const c = token[0];
  const buckets = index.get(c);
  if (!buckets) return null;

  let best = null;
  const lo = Math.max(1, token.length - max);
  const hi = token.length + max;
  for (let len = lo; len <= hi; len++) {
    const arr = buckets.get(len);
    if (!arr) continue;
    for (const w of arr) {
      const d = levenshtein(token, w, max);
      if (d <= max && isBetter(best, d, w, token)) {
        best = { match: w, dist: d };
        if (d === 0) return best;
      }
    }
  }
  return best;
}

function maxDistFor(length) {
  if (length < 5) return 0;
  if (length < 7) return 1;
  return 2;
}

const FUZZY_MIN_LEN = 5;
const SENSITIVE_FUZZY_MIN_LEN = 4;

export function matchToken(raw, opts = {}) {
  const {
    wordlist = loadWordlist(),
    index = buildWordlistIndex(wordlist),
    sensitive = SENSITIVE_TERMS,
    enableDictionaryFuzzy = true,
  } = opts;

  const lowerRaw = String(raw ?? "")
    .toLowerCase()
    .trim();
  const lower = lowerRaw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!lower) return { kind: "unknown" };

  if (/^\d+$/.test(lower)) return { kind: "unknown" };

  const variants = normalizeVariants(lower);
  const allForms = [lower, ...variants.filter((v) => v !== lower)];

  for (const v of allForms) {
    if (sensitive.has(v)) {
      return { kind: "sensitive-exact", match: v, via: v };
    }
  }

  if (wordlist.has(lower)) return { kind: "exact", match: lower };
  for (const v of variants) {
    if (v === lower) continue;
    if (wordlist.has(v)) return { kind: "normalized", match: v, via: v };
  }

  for (const v of allForms) {
    if (v.length < SENSITIVE_FUZZY_MIN_LEN) continue;
    const max = maxDistFor(v.length);
    if (max === 0) continue;
    const best = fuzzyScanSet(v, sensitive, max);
    if (best) {
      return { kind: "sensitive-fuzzy", match: best.match, distance: best.dist, via: v };
    }
  }

  if (enableDictionaryFuzzy) {
    for (const v of allForms) {
      if (v.length < FUZZY_MIN_LEN) continue;
      if (/\d/.test(v)) continue;
      const max = maxDistFor(v.length);
      if (max === 0) continue;
      const best = fuzzyScanIndex(v, index, max);
      if (best) {
        return { kind: "fuzzy", match: best.match, distance: best.dist, via: v };
      }
    }
  }

  return { kind: "unknown" };
}

export function canonicalize(raw, opts) {
  const result = matchToken(raw, opts);
  if (result.kind === "unknown") {
    return String(raw ?? "")
      .toLowerCase()
      .trim();
  }
  return result.match;
}

export function canonicalizeText(text, opts) {
  return String(text ?? "")
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) || part === "" ? part : canonicalize(part, opts)))
    .join("");
}

export function scoreText(text, opts) {
  const counts = {
    tokens: 0,
    exact: 0,
    normalized: 0,
    sensitiveExact: 0,
    sensitiveFuzzy: 0,
    fuzzy: 0,
    unknown: 0,
    hits: [],
  };

  for (const part of String(text ?? "").split(/\s+/)) {
    if (!part) continue;
    counts.tokens++;
    const r = matchToken(part, opts);
    switch (r.kind) {
      case "exact":
        counts.exact++;
        break;
      case "normalized":
        counts.normalized++;
        break;
      case "sensitive-exact":
        counts.sensitiveExact++;
        counts.hits.push({ token: part, ...r });
        break;
      case "sensitive-fuzzy":
        counts.sensitiveFuzzy++;
        counts.hits.push({ token: part, ...r });
        break;
      case "fuzzy":
        counts.fuzzy++;
        counts.hits.push({ token: part, ...r });
        break;
      default:
        counts.unknown++;
    }
  }

  return counts;
}
