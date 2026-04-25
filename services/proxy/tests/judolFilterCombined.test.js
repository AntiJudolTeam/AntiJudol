import { describe, test, expect } from "bun:test";
import { decide } from "../src/filter/judolFilter.js";

describe("decide() — combined mode (algorithm + classifier)", () => {
  test("classifier signal alone is ignored without high confidence", () => {
    // Algorithm finds nothing; classifier is uncertain (0.4) — should allow.
    const r = decide("user", "halo bang", { classifierGambling: 0.4 });
    expect(r.action).toBe("allow");
    expect(r.evidence.classifierGambling).toBe(0.4);
  });

  test("high-confidence classifier blocks even with no algorithm signal", () => {
    // Novel obfuscation that algorithm rules don't match; classifier confident.
    const r = decide("zzz", "completely benign looking phrase", { classifierGambling: 0.95 });
    expect(r.action).toBe("block");
    expect(r.stage).toBe("classifier-confident");
    expect(r.reason).toContain("classifier=0.9500");
  });

  test("strong algorithm block is unaffected by low classifier", () => {
    // "kantorbola99" is a HIGH_CONFIDENCE_BRAND — must block regardless.
    const r = decide("user", "kantorbola99 daftar sekarang", { classifierGambling: 0.05 });
    expect(r.action).toBe("block");
    // Stage should still be the algorithm's brand match, not classifier.
    expect(r.stage).toMatch(/brand|hard/);
  });

  test("classifier shifts borderline score over threshold (FN reduction)", () => {
    // Donor `eth77` is a high-confidence brand → algorithm blocks via donor-brand
    // even without classifier. Use a donor with a weak suspicious-token signal
    // that lands in review territory; classifier pushes it over.
    const baseline = decide("user1", "boss main bareng yuk slot");
    const boosted = decide("user1", "boss main bareng yuk slot", { classifierGambling: 0.95 });
    // Whatever baseline did, classifier-confident should at least not weaken it.
    expect(boosted.evidence.score).toBeGreaterThanOrEqual(baseline.score);
    if (baseline.action !== "block") {
      expect(boosted.action).toBe("block");
    }
  });

  test("low classifier reduces score (FP correction)", () => {
    // Plain message — classifier strongly disagrees.
    const r = decide("user", "makasih bang streamnya", { classifierGambling: 0.02 });
    expect(r.action).toBe("allow");
    expect(r.evidence.classifierBoost).toBeLessThan(0);
  });

  test("classifier override does not fire on anti-judol context", () => {
    // User explicitly denouncing judol — never override to block.
    const r = decide("user", "stop judol bahaya banget bro", { classifierGambling: 0.95 });
    expect(r.action).toBe("allow");
    expect(r.stage).toBe("anti-judol-context");
  });

  test("missing classifier signal behaves like pure algorithm", () => {
    const a = decide("user", "halo bang");
    const b = decide("user", "halo bang", { classifierGambling: null });
    expect(a.action).toBe(b.action);
    expect(b.evidence.classifierGambling).toBeUndefined();
  });

  test("non-finite classifier value is treated as missing", () => {
    const r = decide("user", "halo bang", { classifierGambling: NaN });
    expect(r.action).toBe("allow");
    expect(r.evidence.classifierGambling).toBeUndefined();
  });

  test("real-world example: leet donor escapes classifier but algorithm catches it", () => {
    // From production logs: classifier missed `E-T-H-7-7` (=eth77).
    // Combined mode should block because the algorithm catches the donor brand.
    const r = decide("E-T-H-7-7", "YG LG RME, PLYR BRU D1MNJ4 BNGT!!!", { classifierGambling: 0.3 });
    expect(r.action).toBe("block");
    expect(r.stage).toMatch(/donor/);
  });

  test("classifier reason annotation is included when gambling provided", () => {
    const r = decide("user", "halo", { classifierGambling: 0.5 });
    expect(r.reason).toContain("classifier=0.5000");
  });
});
