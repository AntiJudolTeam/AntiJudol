import { describe, test, expect } from "bun:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeText } from "../src/filter/normalizeText.js";

const LOWER = "abcdefghijklmnopqrstuvwxyz";

const range26 = (start) => {
  let s = "";
  for (let i = 0; i < 26; i++) s += String.fromCodePoint(start + i);
  return s;
};

const range26with = (start, overrides) => {
  let s = "";
  for (let i = 0; i < 26; i++) {
    s += String.fromCodePoint(overrides[i] ?? start + i);
  }
  return s;
};

describe("normalizeText: basic behavior", () => {
  test("empty string returns [\"\"]", () => expect(normalizeText("")).toContain(""));
  test("null returns [\"\"]", () => expect(normalizeText(null)).toContain(""));
  test("undefined returns [\"\"]", () =>
    expect(normalizeText(undefined)).toContain(""));
  test("number returns [\"\"]", () => expect(normalizeText(123)).toContain(""));
  test("object returns [\"\"]", () => expect(normalizeText({})).toContain(""));
  test("plain ASCII passthrough", () =>
    expect(normalizeText("hello world")).toContain("hello world"));
  test("mixed case lowercased", () =>
    expect(normalizeText("Hello World")).toContain("hello world"));
  test("trims outer whitespace", () =>
    expect(normalizeText("  hi  ")).toContain("hi"));
  test("collapses inner whitespace", () =>
    expect(normalizeText("a  b   c")).toContain("a b c"));
  test("tabs and newlines collapse to single space", () =>
    expect(normalizeText("a\tb\nc\r\nd")).toContain("a b c d"));
  test("only whitespace returns empty", () =>
    expect(normalizeText("   \t\n  ")).toContain(""));
  test("digits preserved", () =>
    expect(normalizeText("order 1234")).toContain("order 1234"));
});

describe("normalizeText: fullwidth Latin", () => {
  test("fullwidth uppercase Ａ–Ｚ", () =>
    expect(normalizeText(range26(0xff21))).toContain(LOWER));
  test("fullwidth lowercase ａ–ｚ", () =>
    expect(normalizeText(range26(0xff41))).toContain(LOWER));
  test("fullwidth digits normalize", () =>
    expect(normalizeText("０１２３４５６７８９")).toContain("0123456789"));
  test("fullwidth mixed sentence", () =>
    expect(normalizeText("ＨＥＬＬＯ Ｗｏｒｌｄ")).toContain("hello world"));
});

describe("normalizeText: Mathematical alphanumeric alphabets", () => {
  const cases = [
    ["bold uppercase 𝐀–𝐙", 0x1d400],
    ["bold lowercase 𝐚–𝐳", 0x1d41a],

    ["italic uppercase 𝐴–𝑍", 0x1d434],
    ["italic lowercase 𝑎–𝑧", 0x1d44e, { 7: 0x210e }],

    ["bold italic uppercase 𝑨–𝒁", 0x1d468],
    ["bold italic lowercase 𝒂–𝒛", 0x1d482],

    [
      "script uppercase 𝒜–𝒵",
      0x1d49c,
      {
        1: 0x212c, 4: 0x2130, 5: 0x2131, 7: 0x210b, 8: 0x2110,
        11: 0x2112, 12: 0x2133, 17: 0x211b,
      },
    ],
    ["script lowercase 𝒶–𝓏", 0x1d4b6, { 4: 0x212f, 6: 0x210a, 14: 0x2134 }],

    ["bold script uppercase 𝓐–𝓩", 0x1d4d0],
    ["bold script lowercase 𝓪–𝔃", 0x1d4ea],

    [
      "fraktur uppercase 𝔄–𝔜",
      0x1d504,
      { 2: 0x212d, 7: 0x210c, 8: 0x2111, 17: 0x211c, 25: 0x2128 },
    ],
    ["fraktur lowercase 𝔞–𝔷", 0x1d51e],

    [
      "double-struck uppercase 𝔸–ℤ",
      0x1d538,
      { 2: 0x2102, 7: 0x210d, 13: 0x2115, 15: 0x2119, 16: 0x211a, 17: 0x211d, 25: 0x2124 },
    ],
    ["double-struck lowercase 𝕒–𝕫", 0x1d552],

    ["bold fraktur uppercase 𝕬–𝖅", 0x1d56c],
    ["bold fraktur lowercase 𝖆–𝖟", 0x1d586],

    ["sans-serif uppercase 𝖠–𝖹", 0x1d5a0],
    ["sans-serif lowercase 𝖺–𝗓", 0x1d5ba],

    ["sans-serif bold uppercase 𝗔–𝗭", 0x1d5d4],
    ["sans-serif bold lowercase 𝗮–𝘇", 0x1d5ee],

    ["sans-serif italic uppercase 𝘈–𝘡", 0x1d608],
    ["sans-serif italic lowercase 𝘢–𝘻", 0x1d622],

    ["sans-serif bold italic uppercase 𝘼–𝙕", 0x1d63c],
    ["sans-serif bold italic lowercase 𝙖–𝙯", 0x1d656],

    ["monospace uppercase 𝙰–𝚉", 0x1d670],
    ["monospace lowercase 𝚊–𝚣", 0x1d68a],
  ];

  for (const [name, base, overrides] of cases) {
    test(name, () => {
      const input = overrides ? range26with(base, overrides) : range26(base);
      expect(normalizeText(input)).toContain(LOWER);
    });
  }

  test("mathematical digits 𝟎–𝟗 → 0–9", () => {
    let digits = "";
    for (let i = 0; i < 10; i++) digits += String.fromCodePoint(0x1d7ce + i);
    expect(normalizeText(digits)).toContain("0123456789");
  });
});

describe("normalizeText: Enclosed / circled / squared letters", () => {
  test("circled uppercase Ⓐ–Ⓩ", () =>
    expect(normalizeText(range26(0x24b6))).toContain(LOWER));
  test("circled lowercase ⓐ–ⓩ", () =>
    expect(normalizeText(range26(0x24d0))).toContain(LOWER));
  test("squared 🄰–🅉", () =>
    expect(normalizeText(range26(0x1f130))).toContain(LOWER));
  test("negative circled 🅐–🅩", () =>
    expect(normalizeText(range26(0x1f150))).toContain(LOWER));

  test("negative squared defined letters (A, B, O, P)", () => {
    expect(normalizeText(String.fromCodePoint(0x1f170))).toContain("a");
    expect(normalizeText(String.fromCodePoint(0x1f171))).toContain("b");
    expect(normalizeText(String.fromCodePoint(0x1f17e))).toContain("o");
    expect(normalizeText(String.fromCodePoint(0x1f17f))).toContain("p");
  });

  test("parenthesized letters decompose with parens preserved", () => {
    expect(normalizeText("⒜⒝⒞")).toContain("(a)(b)(c)");
  });
});

describe("normalizeText: diacritics stripped", () => {
  test("acute accent", () => expect(normalizeText("café")).toContain("cafe"));
  test("diaeresis", () => expect(normalizeText("naïve")).toContain("naive"));
  test("precomposed À–Å all flatten to a (then collapse)", () =>
    expect(normalizeText("ÀÁÂÃÄÅ")).toContain("aa"));
  test("varied diacritics on different letters", () =>
    expect(normalizeText("ÀÉÎÕÜ")).toContain("aeiou"));
  test("decomposed a + combining acute", () =>
    expect(normalizeText("á")).toContain("a"));
  test("stacked combining marks", () =>
    expect(normalizeText("á̂̃")).toContain("a"));
  test("cedilla", () => expect(normalizeText("façade")).toContain("facade"));
  test("tilde n", () => expect(normalizeText("piñata")).toContain("pinata"));
  test("zalgo text (many combining marks)", () =>
    expect(normalizeText("h́̂ẽ̄l̅̆lo")).toContain(
      "hello",
    ));
});

describe("normalizeText: superscripts and subscripts", () => {
  test("² ³ fold to 2 3", () => {
    expect(normalizeText("x²+y³")).toContain("x2+y3");
    expect(normalizeText("²³")).toContain("23");
  });
  test("¹ folds to 1", () => expect(normalizeText("e¹")).toContain("e1"));
  test("superscript letters ⁿⁱ fold to n i", () =>
    expect(normalizeText("log ⁿ values ⁱ")).toContain("log n values i"));
  test("subscript digit ₂ folds to 2", () =>
    expect(normalizeText("H₂O")).toContain("h2o"));
  test("subscript letter ₐ folds to a", () =>
    expect(normalizeText("Cₐ test")).toContain("ca test"));
});

describe("normalizeText: emojis removed", () => {
  test("single emoji", () => expect(normalizeText("hi 👋")).toContain("hi"));
  test("emoji with skin tone modifier", () =>
    expect(normalizeText("👍🏽 ok")).toContain("ok"));
  test("ZWJ family sequence", () =>
    expect(normalizeText("👨‍👩‍👧 family")).toContain("family"));
  test("flag emoji (regional indicators) fold to ASCII letters via confusables", () =>
    expect(normalizeText("hello 🇮🇩")).toContain("hello id"));
  test("geometric colored circles", () =>
    expect(normalizeText("🟢🟡🔴 go")).toContain("go"));
  test("misc symbols & dingbats", () =>
    expect(normalizeText("★ ✓ ☂ rain")).toContain("rain"));
  test("emoji between letters removed without adding space", () =>
    expect(normalizeText("ab🎉cd")).toContain("abcd"));
});

describe("normalizeText: zero-width / invisible chars", () => {
  test("zero-width space (U+200B)", () =>
    expect(normalizeText("ab​cd")).toContain("abcd"));
  test("zero-width non-joiner (U+200C)", () =>
    expect(normalizeText("ab‌cd")).toContain("abcd"));
  test("zero-width joiner (U+200D)", () =>
    expect(normalizeText("ab‍cd")).toContain("abcd"));
  test("LTR/RTL marks (U+200E/U+200F)", () =>
    expect(normalizeText("ab‎cd‏ef")).toContain("abcdef"));
  test("LTR/RTL embedding/override (U+202A–U+202E)", () =>
    expect(normalizeText("‮abc‬")).toContain("abc"));
  test("word joiner (U+2060)", () =>
    expect(normalizeText("ab⁠cd")).toContain("abcd"));
  test("byte-order mark (U+FEFF)", () =>
    expect(normalizeText("﻿abc")).toContain("abc"));
  test("soft hyphen (U+00AD)", () =>
    expect(normalizeText("ab­cd")).toContain("abcd"));
});

describe("normalizeText: repeat collapsing", () => {
  test("runs of 3+ same char collapse to 2 (default maxRepeat)", () => {
    expect(normalizeText("aaaaa")).toContain("aa");
    expect(normalizeText("heyyyyy")).toContain("heyy");
    expect(normalizeText("loooool")).toContain("lool");
  });

  test("maxRepeat = 1 collapses to single", () => {
    expect(normalizeText("aaaaa", { maxRepeat: 1 })).toContain("a");
    expect(normalizeText("heyyyyy", { maxRepeat: 1 })).toContain("hey");
  });

  test("maxRepeat = 3 keeps up to triples", () => {
    expect(normalizeText("aaaaa", { maxRepeat: 3 })).toContain("aaa");
  });

  test("repeated punctuation collapses to single", () => {
    expect(normalizeText("wow!!!")).toContain("wow!");
    expect(normalizeText("what??")).toContain("what?");
    expect(normalizeText("hmm...")).toContain("hmm.");
    expect(normalizeText("a--b")).toContain("a-b");
    expect(normalizeText("x;;;y")).toContain("x;y");
    expect(normalizeText("p,,,q")).toContain("p,q");
  });

  test("repeated emoji collapsed (before removal)", () => {
    expect(normalizeText("hiiiii 👋👋👋")).toContain("hii");
  });
});

describe("normalizeText: NFKC exotic forms", () => {
  test("ﬁ ligature → fi", () => expect(normalizeText("ﬁne")).toContain("fine"));
  test("ﬀ ligature → ff", () => expect(normalizeText("ﬀ")).toContain("ff"));
  test("ﬃ ligature → ffi", () => expect(normalizeText("ﬃ")).toContain("ffi"));
  test("ﬆ ligature → st", () => expect(normalizeText("ﬆ")).toContain("st"));
  test("roman numeral Ⅳ → iv", () => expect(normalizeText("Ⅳ")).toContain("iv"));
  test("roman numeral Ⅻ → xii", () => expect(normalizeText("Ⅻ")).toContain("xii"));
});

describe("normalizeText: homoglyph folding", () => {
  test("Cyrillic Ҝ → k", () => expect(normalizeText("Ҝ")).toContain("k"));
  test("Cyrillic homoglyph word (АВСЕНКМОРТХ)", () =>
    expect(normalizeText("АВСЕНКМОРТХ")).toContain("abcehkmoptx"));
  test("Greek homoglyphs (ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ)", () =>
    expect(normalizeText("ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ")).toContain("abezhlkmnoptyx"));
  test("CJK 'kantorbola' variant 1", () =>
    expect(normalizeText("Ҝ卂几ㄒㄖ尺乃ㄖㄥ卂")).toContain("kantorbola"));
  test("individual CJK homoglyphs fold to Latin", () => {
    expect(normalizeText("卂")).toContain("a");
    expect(normalizeText("ㄖ")).toContain("o");
    expect(normalizeText("几")).toContain("n");
    expect(normalizeText("尺")).toContain("r");
    expect(normalizeText("乃")).toContain("b");
    expect(normalizeText("ㄥ")).toContain("l");
  });
});

describe("normalizeText: realistic mixed attacks", () => {
  test("bold letters with zero-width infill", () => {
    const stylized = "𝐉​𝐔​𝐃​𝐎​𝐋";
    expect(normalizeText(stylized)).toContain("judol");
  });

  test("multiple styles mixed", () => {
    const stylized = "Ⓗ𝔢𝓁𝗅𝙤";
    expect(normalizeText(stylized)).toContain("hello");
  });

  test("diacritics + bold + emoji + trailing whitespace", () => {
    expect(normalizeText("  𝐇é𝐥𝐥ô 🎉  ")).toContain("hello");
  });

  test("full sentence with multiple obfuscations", () => {
    const stylized = "𝐕𝐢𝐬𝐢𝐭 Ⓝⓞⓦ!!! 🎉🎉🎉";
    expect(normalizeText(stylized)).toContain("visit now!");
  });

  test("superscript + fullwidth + diacritics", () => {
    expect(normalizeText("Ｃａｆé²")).toContain("cafe2");
  });

  test("real-world judol spam with script-l and curly quotes", () => {
    const spam =
      "Kantorboℓa99.art Permainan Yang Lagi Bagi Pro’fits “STARLIGHT PRINCES” RTP 99% Gas Daf’tar Sekarang";
    expect(normalizeText(spam)).toContain(
      "kantorbola99.art permainan yang lagi bagi pro’fits “starlight princes” rtp 99% gas daf’tar sekarang",
    );
  });
});

describe("normalizeText: ambiguous homoglyph variants", () => {
  test("Ŧ produces both t and f variants", () => {
    const variants = normalizeText("Ŧaro");
    expect(variants).toContain("taro");
    expect(variants).toContain("faro");
  });

  test("multiple ambiguous chars expand combinatorially", () => {
    const variants = normalizeText("ŦŦ");
    expect(variants.length).toBeGreaterThanOrEqual(2);
  });

  test("variant count capped by maxVariants", () => {
    const variants = normalizeText("ŦŦŦŦŦŦŦŦŦŦ", { maxVariants: 16 });
    expect(variants.length).toBeLessThanOrEqual(16);
  });
});

describe("normalizeText: homoglyph data file coverage", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dataPath = path.resolve(__dirname, "..", "scripts", "charset.json");
  const raw = fs.readFileSync(dataPath, "utf8").replace(/\\'/g, "'");
  const maps = JSON.parse(raw);

  const UPPER = LOWER.toUpperCase();
  const squeeze = (s) => s.replace(/[^a-z0-9]+/g, "");

  const UNSUPPORTED = new Set([
    "emojiCharMap",
    "uniqSymbolsFontCharMap",
    "bigBlockCharMap",
    "s2",
    "s4",
  ]);

  for (const [mapName, m] of Object.entries(maps)) {
    if (typeof m !== "object" || m === null) continue;
    if (UNSUPPORTED.has(mapName)) continue;

    const stringified =
      [...UPPER].map((ch) => m[ch] ?? ch).join("") +
      [...LOWER].map((ch) => m[ch] ?? ch).join("");

    const expected = LOWER.repeat(2);

    test(`${mapName} folds to a-z,a-z`, () => {
      const variants = normalizeText(stringified, { maxVariants: 1024 });
      const squeezed = variants.map(squeeze);
      expect(squeezed).toContain(expected);
    });
  }
});
