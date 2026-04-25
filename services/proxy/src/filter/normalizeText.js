import emojiRegex from "emoji-regex";
import { remove as foldConfusables } from "confusables";
import { HOMOGLYPHS, LIGATURES } from "./homoglyphs.js";

const EMOJI_RE = emojiRegex();
// Catch-all for emoji code points and bidi/variation selectors that aren't
// reliably matched by emoji-regex. Variation selectors (FE00-FE0F) intentionally
// share a class with emoji ranges — eslint flags this as "misleading combined
// chars" but it's the cheapest way to strip them in one pass.
const EMOJI_RANGES_RE =
  /* eslint-disable-next-line no-misleading-character-class */
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1F7E0}-\u{1F7FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{24C2}-\u{24FF}]+/gu;
// U+200B–U+200F (zero-width + LRM/RLM), U+202A–U+202E (bidi controls),
// U+2060 (word joiner), U+FEFF (BOM/ZWNBSP), U+00AD (soft hyphen).
const ZERO_WIDTH_RE = /[​-‏‪-‮⁠﻿­]/gu;
const COMBINING_RE = /\p{M}/gu;
const REPEAT_ANY_RE = /(.)\1{2,}/gu;
const REPEAT_PUNCT_RE = /([.!?,;:~\-]){2,}/gu;
const REPEAT_CHAR_RE = /(?<!\S)(\S)\1{3,}(?!\S)|(\p{L})\2{3,}/gu;
const MULTI_SPACE_RE = /\s+/g;

const ORNAMENT_RE = /[•¤¦§¨¬¯°´¶˜∀-⋿─-◿⦀-⧿⬀-⯿、-〿぀-ゟ゠-ヿ㐀-䶿一-鿿｜\[\]{}]/gu;

function foldHomoglyphs(str, maxVariants) {
  let branches = [""];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const mapping = HOMOGLYPHS.get(cp);
    if (!mapping) {
      for (let i = 0; i < branches.length; i++) branches[i] += ch;
    } else if (mapping.length === 1) {
      for (let i = 0; i < branches.length; i++) branches[i] += mapping;
    } else if (branches.length * mapping.length > maxVariants) {
      for (let i = 0; i < branches.length; i++) branches[i] += mapping[0];
    } else {
      const next = [];
      for (const b of branches) for (const letter of mapping) next.push(b + letter);
      branches = next;
    }
  }
  return branches;
}

export function normalizeText(text, { maxRepeat = 2, maxVariants = 16 } = {}) {
  if (typeof text !== "string" || text.length === 0) return [""];

  let pre = text;
  for (const [seq, letter] of LIGATURES) pre = pre.split(seq).join(letter);

  const branches = foldHomoglyphs(pre, maxVariants);
  const results = new Set();

  for (let out of branches) {
    out = out.normalize("NFKC");
    out = foldConfusables(out);
    out = out.normalize("NFKD").replace(COMBINING_RE, "");
    out = out.replace(REPEAT_ANY_RE, (_, ch) => ch.repeat(maxRepeat));
    out = out
      .replace(EMOJI_RE, "")
      .replace(EMOJI_RANGES_RE, " ")
      .replace(ORNAMENT_RE, "")
      .replace(ZERO_WIDTH_RE, "")
      .replace(REPEAT_PUNCT_RE, "$1")
      .replace(REPEAT_CHAR_RE, "$1$2")
      .replace(MULTI_SPACE_RE, " ")
      .trim()
      .toLowerCase();
    results.add(out);
  }

  return [...results];
}
