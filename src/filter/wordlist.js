import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PATH = path.join(__dirname, "../..", "data", "wordlist-indonesia.txt");

export const SENSITIVE_TERMS = new Set(["gacor", "maxwin", "cuan", "jackpot", "scatter", "rtp", "slot", "togel", "toto", "judol", "judi", "bocoran", "sultan", "depo", "deposit", "mindep", "rollingan", "rebate", "turnover", "freechip", "freebet", "freespin", "gacha", "withdraw"]);

let cachedWordlist = null;
let cachedIndex = null;
let cachedPath = null;

const LETTER_ONLY_RE = /^[a-z]+$/;

export function loadWordlist(filePath = DEFAULT_PATH) {
  if (cachedWordlist && cachedPath === filePath) return cachedWordlist;

  const raw = fs.readFileSync(filePath, "utf-8");
  const set = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim().toLowerCase();
    if (t && LETTER_ONLY_RE.test(t)) set.add(t);
  }

  cachedWordlist = set;
  cachedPath = filePath;
  cachedIndex = null;
  return set;
}

export function buildWordlistIndex(wordlist = loadWordlist()) {
  if (cachedIndex && wordlist === cachedWordlist) return cachedIndex;

  const idx = new Map();
  for (const w of wordlist) {
    if (!w) continue;
    const c = w[0];
    const l = w.length;
    let byLen = idx.get(c);
    if (!byLen) {
      byLen = new Map();
      idx.set(c, byLen);
    }
    let arr = byLen.get(l);
    if (!arr) {
      arr = [];
      byLen.set(l, arr);
    }
    arr.push(w);
  }

  if (wordlist === cachedWordlist) cachedIndex = idx;
  return idx;
}
