import { describe, test, expect } from "bun:test";
import {
  normalize,
  normalizeVariants,
  matchToken,
  canonicalize,
  canonicalizeText,
  scoreText,
} from "../src/filter/typoMatcher.js";
import { loadWordlist, SENSITIVE_TERMS } from "../src/filter/wordlist.js";

describe("wordlist", () => {
  test("loads Indonesian dictionary with common words", () => {
    const wl = loadWordlist();
    expect(wl.has("langsung")).toBe(true);
    expect(wl.has("meledak")).toBe(true);
    expect(wl.has("setiap")).toBe(true);
    expect(wl.has("putaran")).toBe(true);
    expect(wl.has("sultan")).toBe(true);
  });

  test("entries are lowercased and deduped", () => {
    const wl = loadWordlist();
    expect(wl.has("LANGSUNG")).toBe(false);
    expect(wl.has("langsung")).toBe(true);
  });

  test("sensitive terms set contains judol vocabulary", () => {
    expect(SENSITIVE_TERMS.has("gacor")).toBe(true);
    expect(SENSITIVE_TERMS.has("maxwin")).toBe(true);
    expect(SENSITIVE_TERMS.has("freechip")).toBe(true);
  });
});

describe("normalize", () => {
  test("lowercases and strips decoration", () => {
    expect(normalize("LANGSUNG")).toBe("langsung");
    expect(normalize("Lang​sung")).toBe("langsung"); // zero-width inside
  });

  test("applies leet fold (1->i default)", () => {
    expect(normalize("s1tus")).toBe("situs");
    expect(normalize("g4c0r")).toBe("gacor");
  });

  test("tightens punct-obfuscated chains", () => {
    expect(normalize("s.l.o.t")).toBe("slot");
    expect(normalize("g*a*c*o*r")).toBe("gacor");
    expect(normalize("s/l/o/t")).toBe("slot");
  });

  test("tightens spaced single-char chains", () => {
    expect(normalize("s l o t")).toBe("slot");
    expect(normalize("w d")).toBe("wd");
  });
});

describe("normalizeVariants", () => {
  test("produces both 1->i and 1->l leet folds", () => {
    const v = normalizeVariants("kl1k");
    expect(v).toContain("klik");
    expect(v).toContain("kllk");
  });
});

describe("matchToken: exact + normalized", () => {
  test("raw dictionary hit", () => {
    const r = matchToken("langsung");
    expect(r.kind).toBe("exact");
    expect(r.match).toBe("langsung");
  });

  test("obfuscated normalizes to dictionary word", () => {
    const r = matchToken("l4ngsung");
    expect(r.kind).toBe("normalized");
    expect(r.match).toBe("langsung");
  });

  test("punct-obfuscated normalizes to dictionary word", () => {
    const r = matchToken("m.a.k.a.n");
    expect(r.kind).toBe("normalized");
    expect(r.match).toBe("makan");
  });
});

describe("matchToken: sensitive terms", () => {
  test("sensitive exact wins over dictionary", () => {
    const r = matchToken("slot");
    expect(r.kind).toBe("sensitive-exact");
    expect(r.match).toBe("slot");
  });

  test("obfuscated sensitive term normalizes and matches", () => {
    const r = matchToken("g4c0r");
    expect(r.kind).toBe("sensitive-exact");
    expect(r.match).toBe("gacor");
  });

  test("punct-obfuscated sensitive term", () => {
    const r = matchToken("s.l.o.t");
    expect(r.kind).toBe("sensitive-exact");
    expect(r.match).toBe("slot");
  });

  test("fuzzy sensitive: typo of gacor", () => {
    const r = matchToken("gacoor"); // extra o
    expect(r.kind).toBe("sensitive-fuzzy");
    expect(r.match).toBe("gacor");
    expect(r.distance).toBe(1);
  });

  test("fuzzy sensitive: typo of maxwin", () => {
    const r = matchToken("maxwinn");
    expect(r.kind).toBe("sensitive-fuzzy");
    expect(r.match).toBe("maxwin");
  });
});

describe("matchToken: dictionary fuzzy", () => {
  test("vowel-dropped dictionary word", () => {
    const r = matchToken("lngsung");
    expect(r.kind).toBe("fuzzy");
    expect(r.match).toBe("langsung");
    expect(r.distance).toBe(1);
  });

  test("typo sltan -> sultan", () => {
    const r = matchToken("sltan");
    expect(r.kind).toBe("sensitive-fuzzy");
    expect(r.match).toBe("sultan");
  });

  test("insertion typo akunn -> akun (LCP tie-break)", () => {
    const r = matchToken("akunn");
    expect(r.kind).toBe("fuzzy");
    expect(r.match).toBe("akun");
  });

  test("short tokens skip fuzzy (stricter threshold)", () => {
    const r = matchToken("jd");
    expect(r.kind).toBe("unknown");
  });

  test("tokens with digits skip dictionary fuzzy", () => {
    const r = matchToken("fan123");
    expect(r.kind).toBe("unknown");
  });

  test("nonsense stays unknown", () => {
    const r = matchToken("asdfghjklqwerty");
    expect(r.kind).toBe("unknown");
  });
});

describe("canonicalize", () => {
  test("returns dictionary form for a typo", () => {
    expect(canonicalize("lngsung")).toBe("langsung");
  });

  test("returns sensitive form for obfuscated sensitive", () => {
    expect(canonicalize("g4c0r")).toBe("gacor");
  });

  test("passes through unknown tokens unchanged (lowercased)", () => {
    expect(canonicalize("ZZZ123")).toBe("zzz123");
  });
});

describe("canonicalizeText", () => {
  test("rewrites vowel-dropped judol line", () => {
    const out = canonicalizeText("ptrannya lngsung jd sltan");
    expect(out).toContain("langsung");
    expect(out).toContain("sultan");
  });

  test("preserves whitespace layout", () => {
    const out = canonicalizeText("makan   siang");
    expect(out).toBe("makan   siang");
  });
});

describe("scoreText", () => {
  test("flags sensitive hits", () => {
    const s = scoreText("slot gacor hari ini");
    expect(s.sensitiveExact).toBeGreaterThan(0);
    expect(s.hits.length).toBeGreaterThan(0);
  });

  test("no sensitive hits on clean donation text", () => {
    const s = scoreText("terima kasih sudah streaming");
    expect(s.sensitiveExact).toBe(0);
    expect(s.sensitiveFuzzy).toBe(0);
  });
});
