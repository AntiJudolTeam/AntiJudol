import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, "charset.json");
const TARGET = path.resolve(__dirname, "..", "src", "filter", "homoglyphs.js");

const raw = fs.readFileSync(SOURCE, "utf8").replace(/\\'/g, "'");
const maps = JSON.parse(raw);

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = ALPHABET.toLowerCase();
const ASCII_LETTERS = new Set([...ALPHABET, ...LOWER]);

const map = new Map();
const ligatures = new Map();

let totalSlots = 0;
let skippedIdentity = 0;
const skipped = [];

for (const [mapName, m] of Object.entries(maps)) {
  if (typeof m !== "object" || m === null) {
    skipped.push(`${mapName}: not an object, skipped`);
    continue;
  }
  for (const [key, glyph] of Object.entries(m)) {
    if (key.length !== 1 || !ASCII_LETTERS.has(key)) continue;
    if (typeof glyph !== "string" || glyph.length === 0) continue;

    totalSlots++;
    const target = key.toUpperCase();
    const cps = [...glyph];

    if (cps.length === 1 && cps[0] === key) {
      skippedIdentity++;
      continue;
    }

    if (cps.length === 1) {
      const cp = cps[0].codePointAt(0);
      addCodepoint(cp, target);
    } else {
      addLigature(glyph, target);
    }
  }
}

function isEmojiRange(cp) {
  return (
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x1f1e0 && cp <= 0x1f1ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f)
  );
}

function addCodepoint(cp, target) {
  const ch = String.fromCodePoint(cp);
  if (ASCII_LETTERS.has(ch)) return;

  if (isEmojiRange(cp)) return;

  const existing = map.get(cp);
  if (!existing) map.set(cp, target);
  else if (!existing.includes(target)) map.set(cp, existing + target);
}

function addLigature(seq, target) {
  const existing = ligatures.get(seq);
  if (!existing) ligatures.set(seq, target);
  else if (!existing.includes(target)) ligatures.set(seq, existing + target);
}

const sorted = [...map.entries()].sort((a, b) => a[0] - b[0]);
const singles = sorted.filter(([, v]) => v.length === 1);
const ambiguous = sorted.filter(([, v]) => v.length > 1);

const linesOut = [
  "// AUTO-GENERATED from scripts/charset.json by scripts/build-homoglyphs.js.",
  "// Do not hand-edit — regenerate with `bun scripts/build-homoglyphs.js`.",
  "",
  "// Map<codepoint, string>. Single-char value = unambiguous fold.",
  "// Multi-char value = ambiguous — normalizeText branches and emits a variant",
  "// per interpretation.",
  "export const HOMOGLYPHS = new Map([",
];

const byLetter = new Map();
for (const [cp, v] of singles) {
  if (!byLetter.has(v)) byLetter.set(v, []);
  byLetter.get(v).push(cp);
}
for (const letter of ALPHABET) {
  const cps = byLetter.get(letter) ?? [];
  if (!cps.length) continue;
  linesOut.push(`  // → ${letter}`);
  for (let i = 0; i < cps.length; i += 8) {
    const chunk = cps
      .slice(i, i + 8)
      .map((cp) => `[0x${cp.toString(16)}, "${letter}"]`)
      .join(", ");
    linesOut.push(`  ${chunk},`);
  }
}
if (ambiguous.length) {
  linesOut.push("  // Ambiguous (branch during fold):");
  for (const [cp, v] of ambiguous) {
    linesOut.push(`  [0x${cp.toString(16)}, ${JSON.stringify(v)}],`);
  }
}
linesOut.push("]);");
linesOut.push("");
linesOut.push("// Multi-grapheme sequences that visually represent one letter. Applied as");
linesOut.push("// string.replace() before the char-by-char fold.");
linesOut.push("export const LIGATURES = [");
for (const [seq, target] of ligatures) {
  linesOut.push(`  [${JSON.stringify(seq)}, ${JSON.stringify(target)}],`);
}
linesOut.push("];");
linesOut.push("");

fs.writeFileSync(TARGET, linesOut.join("\n"), "utf8");

console.log(`Wrote ${TARGET}`);
console.log(`  Processed ${Object.keys(maps).length} char maps, ${totalSlots} slot entries`);
console.log(`  ${singles.length} unambiguous + ${ambiguous.length} ambiguous codepoints`);
console.log(`  ${ligatures.size} ligature(s)`);
console.log(`  ${skippedIdentity} identity mappings skipped`);
if (skipped.length) {
  console.log("Skipped maps:");
  for (const s of skipped) console.log("  " + s);
}
if (ambiguous.length) {
  console.log("\nAmbiguous codepoints:");
  for (const [cp, v] of ambiguous) {
    console.log(`  U+${cp.toString(16).toUpperCase().padStart(4, "0")} (${String.fromCodePoint(cp)}) → ${v}`);
  }
}
