import { normalizeText } from "./normalizeText.js";
import { canonicalizeText } from "./typoMatcher.js";
import { foldLeet, tightenIntraWord, levenshtein, LEET_CHAR_RE } from "./textUtils.js";
import {
  HIGH_CONFIDENCE_BRANDS,
  AMBIGUOUS_BRANDS,
  HARD_MESSAGE_PATTERNS,
  PROMO_MESSAGE_PATTERNS,
  WEAK_MESSAGE_PATTERNS,
  SUSPICIOUS_TOKEN_PATTERNS,
  ANTI_JUDOL_PHRASES,
  GAMING_SAFE_PHRASES,
  GENERAL_SAFE_PHRASES,
  STRONG_GAMING_CONTEXT,
  LEET_FOLDS,
  GAMBLING_STEM_SET,
} from "../../data/blocklist.js";

const TOKEN_RE = /[a-z0-9]+/g;
const NON_WORD_RE = /[^a-z0-9]+/gi;
const BRAND_SUBSTRING_MIN = 6;
const NEAR_BRAND_MIN_LEN = 9;
const NEAR_BRAND_MAX_DIST = 2;

// Word + space + digit-tail, e.g. "eth 77" -> "eth77", "hoki 88" -> "hoki88".
const LETTER_DIGIT_GAP_RE = /\b([a-z]{2,8})\s+(\d{2,4})\b/gi;

// Soft promo IDs eligible for the gaming-context override.
const GAMING_OVERRIDE_PROMO_IDS = new Set([
  "win-guarantee",
  "jp-claim",
  "profit-boost",
  "gacor-intensifier",
  "multiplier-hype",
  "win-chance",
]);

const PHRASE_REGEX_CACHE = new Map();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPhraseRegex(phrase) {
  if (!PHRASE_REGEX_CACHE.has(phrase)) {
    const escaped = escapeRegex(phrase);
    PHRASE_REGEX_CACHE.set(phrase, new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i"));
  }
  return PHRASE_REGEX_CACHE.get(phrase);
}

const SMART_LEET_MAP = Object.freeze({
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

function foldLeetSmart(text) {
  return text.replace(LEET_CHAR_RE, (ch, offset, full) => {
    if (!/\d/.test(ch)) return SMART_LEET_MAP[ch] ?? ch;
    const prev = full[offset - 1];
    const next = full[offset + 1];
    const prevIsLetter = prev && /[a-z]/i.test(prev);
    const nextIsLetter = next && /[a-z]/i.test(next);
    if (prevIsLetter && nextIsLetter) return SMART_LEET_MAP[ch] ?? ch;
    return ch;
  });
}

function squeeze(text) {
  return text.replace(NON_WORD_RE, "").toLowerCase();
}

function tokenize(text) {
  return text.match(TOKEN_RE) ?? [];
}

function addVariant(set, value) {
  if (!value) return;
  set.add(value);

  const tight = tightenIntraWord(value);
  if (tight) set.add(tight);

  const wordified = value.replace(/[^a-z0-9]+/gi, " ").trim();
  if (wordified && wordified !== value) set.add(wordified);
}

function buildVariants(value) {
  const bases = normalizeText(String(value ?? "")).filter(Boolean);
  const variants = new Set();

  if (bases.length === 0) {
    return {
      raw: "",
      variants: [],
      tokens: new Set(),
      squeezed: [],
    };
  }

  for (const base of bases) {
    addVariant(variants, base);

    for (const map of LEET_FOLDS) {
      addVariant(variants, foldLeet(base, map));
    }

    addVariant(variants, foldLeetSmart(base));
  }

  for (const base of bases) {
    const canon = canonicalizeText(base);
    if (canon) addVariant(variants, canon);
  }

  for (const variant of [...variants]) {
    let changed = false;
    const collapsed = variant.replace(LETTER_DIGIT_GAP_RE, (m, letters, digits) => {
      const candidate = (letters + digits).toLowerCase();
      if (HIGH_CONFIDENCE_BRANDS.has(candidate)) {
        changed = true;
        return candidate;
      }

      if (GAMBLING_STEM_SET.has(letters.toLowerCase()) && !/^[1-9]0+$/.test(digits)) {
        changed = true;
        return candidate;
      }
      return m;
    });
    if (changed) addVariant(variants, collapsed);
  }

  const tokenSet = new Set();
  const squeezedSet = new Set();
  for (const variant of variants) {
    for (const token of tokenize(variant)) {
      tokenSet.add(token);
    }
    const sq = squeeze(variant);
    if (sq) squeezedSet.add(sq);
  }

  return {
    raw: bases[0],
    variants: [...variants],
    tokens: tokenSet,
    squeezed: [...squeezedSet],
  };
}

function findBrandHits(prepared, brandSet) {
  const hits = new Set();
  for (const brand of brandSet) {
    if (prepared.tokens.has(brand)) {
      hits.add(brand);
      continue;
    }
    if (brand.length >= BRAND_SUBSTRING_MIN) {
      for (const sq of prepared.squeezed) {
        if (sq.includes(brand)) {
          hits.add(brand);
          break;
        }
      }
    }
  }
  return [...hits];
}

function findNearBrandHits(prepared, brandSet, exactHits) {
  const hits = new Set();
  const exactSet = new Set(exactHits);
  for (const brand of brandSet) {
    if (exactSet.has(brand)) continue;
    if (brand.length < NEAR_BRAND_MIN_LEN) continue;

    const minLen = Math.max(NEAR_BRAND_MIN_LEN, brand.length - NEAR_BRAND_MAX_DIST);
    const maxLen = brand.length + NEAR_BRAND_MAX_DIST;

    let matched = false;

    for (const token of prepared.tokens) {
      if (token.length < minLen || token.length > maxLen) continue;
      if (token === brand) continue;
      if (levenshtein(token, brand, NEAR_BRAND_MAX_DIST) <= NEAR_BRAND_MAX_DIST) {
        hits.add(brand);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const sq of prepared.squeezed) {
      if (sq.length < minLen || sq.length > maxLen) continue;
      if (sq === brand) continue;
      if (levenshtein(sq, brand, NEAR_BRAND_MAX_DIST) <= NEAR_BRAND_MAX_DIST) {
        hits.add(brand);
        break;
      }
    }
  }
  return [...hits];
}

function collectRuleHits(variants, rules) {
  const hits = [];

  for (const rule of rules) {
    for (const variant of variants) {
      const match = variant.match(rule.regex);
      if (match) {
        hits.push({
          id: rule.id,
          value: match[0],
          weight: rule.weight ?? 1,
        });
        break;
      }
    }
  }

  return hits;
}

function collectPhraseHits(variants, phrases) {
  const hits = [];

  for (const phrase of phrases) {
    const re = getPhraseRegex(phrase);
    for (const variant of variants) {
      if (re.test(variant)) {
        hits.push(phrase);
        break;
      }
    }
  }

  return hits;
}

function sumWeights(hits) {
  return hits.reduce((sum, hit) => sum + (hit.weight ?? 1), 0);
}

function previewList(items, limit = 3) {
  return items.slice(0, limit).join(", ");
}

function previewRuleHits(hits, limit = 3) {
  return hits
    .slice(0, limit)
    .map((x) => `"${x.value}"`)
    .join(", ");
}

function inspectField(value, { messageMode = false } = {}) {
  const prepared = buildVariants(value);

  const highBrands = findBrandHits(prepared, HIGH_CONFIDENCE_BRANDS);
  const ambiguousBrands = findBrandHits(prepared, AMBIGUOUS_BRANDS);
  const nearBrands = findNearBrandHits(prepared, HIGH_CONFIDENCE_BRANDS, highBrands);
  const suspicious = collectRuleHits(prepared.variants, SUSPICIOUS_TOKEN_PATTERNS);

  let hard = collectRuleHits(prepared.variants, HARD_MESSAGE_PATTERNS);
  let promo = messageMode ? collectRuleHits(prepared.variants, PROMO_MESSAGE_PATTERNS) : [];
  const weak = messageMode ? collectRuleHits(prepared.variants, WEAK_MESSAGE_PATTERNS) : [];
  const antiJudol = messageMode ? collectPhraseHits(prepared.variants, ANTI_JUDOL_PHRASES) : [];
  const gamingSafe = messageMode ? collectPhraseHits(prepared.variants, GAMING_SAFE_PHRASES) : [];
  const generalSafe = messageMode ? collectPhraseHits(prepared.variants, GENERAL_SAFE_PHRASES) : [];
  const strongGamingContext = messageMode ? collectPhraseHits(prepared.variants, STRONG_GAMING_CONTEXT) : [];

  if (strongGamingContext.length > 0) {
    const sultanHits = hard.filter((h) => h.id === "sultan-promise").map((h) => ({ ...h, weight: 4 }));
    if (sultanHits.length > 0) {
      hard = hard.filter((h) => h.id !== "sultan-promise");
      promo = [...promo, ...sultanHits];
    }
  }

  return {
    raw: prepared.raw,
    variants: prepared.variants,
    tokens: prepared.tokens,
    highBrands,
    ambiguousBrands,
    nearBrands,
    suspicious,
    hard,
    promo,
    weak,
    antiJudol,
    gamingSafe,
    generalSafe,
    strongGamingContext,
  };
}

export function analyze(donator, message) {
  const donor = inspectField(donator);
  const msg = inspectField(message, { messageMode: true });

  const hasHard = msg.hard.length > 0;
  const hasPromo = msg.promo.length > 0;
  const weakCluster = msg.weak.length >= 2;
  const hasMessageBrand = msg.highBrands.length > 0 || msg.ambiguousBrands.length > 0;
  const hasDonorBrand = donor.highBrands.length > 0 || donor.ambiguousBrands.length > 0;
  const antiJudol = msg.antiJudol.length > 0;

  let score = 0;

  score += Math.min(msg.highBrands.length, 2) * 5;
  score += Math.min(msg.ambiguousBrands.length, 2) * 3;
  score += sumWeights(msg.hard);
  score += sumWeights(msg.promo);
  score += Math.min(msg.weak.length, 3);

  score += Math.min(donor.highBrands.length, 1) * 2;
  score += Math.min(donor.ambiguousBrands.length, 1) * 1;
  score += Math.min(donor.suspicious.length, 2) * 1;
  score += Math.min(msg.suspicious.length, 2) * 1;

  if (!hasHard) {
    if (msg.gamingSafe.length > 0 && msg.weak.length === 1 && msg.weak[0].id === "weak-slot") {
      score -= 3;
    }

    if (msg.generalSafe.length > 0 && !hasPromo && !hasMessageBrand) {
      score -= 2;
    }

    if (antiJudol && !hasPromo && !hasMessageBrand) {
      score -= 5;
    }
  }

  return {
    donor,
    msg,
    flags: {
      hasHard,
      hasPromo,
      weakCluster,
      antiJudol,
      hasMessageBrand,
      hasDonorBrand,
    },
    score,
  };
}

// Classifier integration tunables. The classifier reports a 0..1 gambling
// probability; we map it to ±5 score points so a confident classifier can flip
// borderline cases either way without overpowering the rule-based signals.
const CLASSIFIER_SCORE_RANGE = 5;
const CLASSIFIER_BLOCK_THRESHOLD = 0.85;

function classifierScoreContribution(gambling) {
  if (gambling == null || !Number.isFinite(gambling)) return 0;
  return Math.round((gambling - 0.5) * 2 * CLASSIFIER_SCORE_RANGE);
}

function buildReason(ctx) {
  const parts = [`score=${ctx.score}`];

  if (ctx.classifierGambling != null) {
    parts.push(`classifier=${ctx.classifierGambling.toFixed(4)}`);
  }
  if (ctx.classifierBoost != null && ctx.classifierBoost !== 0) {
    parts.push(`classifierBoost=${ctx.classifierBoost > 0 ? "+" : ""}${ctx.classifierBoost}`);
  }
  if (ctx.msg.hard.length) {
    parts.push(`hard=${previewRuleHits(ctx.msg.hard)}`);
  }
  if (ctx.donor.hard.length) {
    parts.push(`donorHard=${previewRuleHits(ctx.donor.hard)}`);
  }
  if (ctx.msg.promo.length) {
    parts.push(`promo=${previewRuleHits(ctx.msg.promo)}`);
  }
  if (ctx.msg.highBrands.length) {
    parts.push(`msgBrands=${previewList(ctx.msg.highBrands)}`);
  }
  if (ctx.msg.nearBrands.length) {
    parts.push(`msgNearBrands=${previewList(ctx.msg.nearBrands)}`);
  }
  if (ctx.msg.ambiguousBrands.length) {
    parts.push(`msgAmbiguous=${previewList(ctx.msg.ambiguousBrands)}`);
  }
  if (ctx.donor.highBrands.length) {
    parts.push(`donorBrands=${previewList(ctx.donor.highBrands)}`);
  }
  if (ctx.donor.nearBrands.length) {
    parts.push(`donorNearBrands=${previewList(ctx.donor.nearBrands)}`);
  }
  if (ctx.donor.ambiguousBrands.length) {
    parts.push(`donorAmbiguous=${previewList(ctx.donor.ambiguousBrands)}`);
  }
  if (ctx.donor.suspicious.length) {
    parts.push(`donorSuspicious=${previewRuleHits(ctx.donor.suspicious)}`);
  }
  if (ctx.msg.antiJudol.length) {
    parts.push(`antiJudol=${previewList(ctx.msg.antiJudol)}`);
  }
  if (ctx.msg.gamingSafe.length) {
    parts.push(`gamingSafe=${previewList(ctx.msg.gamingSafe)}`);
  }
  if (ctx.msg.generalSafe.length) {
    parts.push(`generalSafe=${previewList(ctx.msg.generalSafe)}`);
  }
  if (ctx.msg.strongGamingContext.length) {
    parts.push(`strongGaming=${previewList(ctx.msg.strongGamingContext)}`);
  }

  return parts.join("; ");
}

function applyDecisionRules(ctx) {
  if (ctx.flags.antiJudol && !ctx.flags.hasHard && !ctx.flags.hasPromo && !ctx.flags.hasMessageBrand) {
    return {
      action: "allow",
      stage: "anti-judol-context",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.flags.hasHard) {
    return {
      action: "block",
      stage: "hard-message",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.donor.hard.length > 0) {
    return {
      action: "block",
      stage: "hard-donor",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.msg.highBrands.length > 0 || ctx.msg.nearBrands.length > 0) {
    return {
      action: "block",
      stage: ctx.msg.highBrands.length > 0 ? "message-brand" : "message-near-brand",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.donor.highBrands.length > 0 || ctx.donor.nearBrands.length > 0) {
    return {
      action: "block",
      stage: ctx.donor.highBrands.length > 0 ? "donor-brand" : "donor-near-brand",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.donor.suspicious.some((h) => h.id === "judol-chain")) {
    return {
      action: "block",
      stage: "donor-judol-chain",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if ((ctx.flags.hasMessageBrand || ctx.flags.hasDonorBrand) && ctx.flags.hasPromo) {
    return {
      action: "block",
      stage: "brand-assisted-promo",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.msg.promo.length >= 2) {
    return {
      action: "block",
      stage: "two-promo",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.msg.promo.length >= 1) {
    if (
      ctx.msg.promo.length === 1 &&
      GAMING_OVERRIDE_PROMO_IDS.has(ctx.msg.promo[0].id) &&
      ctx.msg.gamingSafe.length > 0 &&
      !ctx.flags.hasMessageBrand &&
      !ctx.flags.hasDonorBrand
    ) {
      return {
        action: "allow",
        stage: "gaming-context-override",
        score: ctx.score,
        reason: buildReason(ctx),
        evidence: ctx,
      };
    }
    return {
      action: "review",
      stage: "single-promo",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  const messageEvidenceBuckets =
    Number(ctx.msg.highBrands.length > 0) +
    Number(ctx.msg.ambiguousBrands.length > 0) +
    Number(ctx.msg.promo.length > 0) +
    Number(ctx.msg.weak.length >= 2) +
    Number(ctx.msg.suspicious.length > 0);

  if (ctx.score >= 9 && messageEvidenceBuckets >= 2) {
    return {
      action: "block",
      stage: "score-threshold",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  if (ctx.score >= 5 && (ctx.flags.hasDonorBrand || ctx.donor.suspicious.length > 0 || ctx.msg.weak.length > 0)) {
    return {
      action: "review",
      stage: "review-threshold",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  return {
    action: "allow",
    stage: "default",
    score: ctx.score,
    reason: buildReason(ctx),
    evidence: ctx,
  };
}

/**
 * Combined-mode entry point.
 *
 * @param {string | null | undefined} donator
 * @param {string | null | undefined} message
 * @param {{ classifierGambling?: number | null }} [opts]
 *   classifierGambling: 0..1 probability from the ML classifier. When provided,
 *   it is folded into the algorithm's score (signed, ±5 range) and a strong
 *   classifier signal can promote borderline allow/review cases to block.
 * @returns {Decision}
 */
export function decide(donator, message, opts = {}) {
  const { classifierGambling = null } = opts;

  const hasDonor = String(donator ?? "").trim().length > 0;
  const hasMessage = String(message ?? "").trim().length > 0;

  if (!hasDonor && !hasMessage) {
    return {
      action: "allow",
      stage: "empty",
      score: 0,
      reason: "empty input",
    };
  }

  const ctx = analyze(donator, message);

  // Fold classifier confidence into the algorithm score. The shift is signed,
  // so a confident "not gambling" verdict can also pull a borderline case down.
  if (classifierGambling != null && Number.isFinite(classifierGambling)) {
    const boost = classifierScoreContribution(classifierGambling);
    ctx.score += boost;
    ctx.classifierGambling = classifierGambling;
    ctx.classifierBoost = boost;
  }

  const decision = applyDecisionRules(ctx);

  // Classifier override: if the algorithm allowed/reviewed but the classifier
  // is highly confident this is gambling, escalate to block. Anti-judol context
  // (explicit denouncement) is the one signal we never override.
  if (
    classifierGambling != null &&
    classifierGambling >= CLASSIFIER_BLOCK_THRESHOLD &&
    decision.action !== "block" &&
    !ctx.flags.antiJudol
  ) {
    return {
      action: "block",
      stage: "classifier-confident",
      score: ctx.score,
      reason: buildReason(ctx),
      evidence: ctx,
    };
  }

  return decision;
}
