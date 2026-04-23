import express from "express";
import { logger } from "../../utils/logger.js";
import { logFeedback } from "../../utils/feedbackLog.js";
import { createRateLimiter } from "../../utils/rateLimit.js";

const router = express.Router();

const MAX_FIELD_LENGTH = 4096;

const feedbackLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  name: "feedback-rl",
});

function asString(value) {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_FIELD_LENGTH);
}

const VALID_DECISIONS = new Set(["block", "allow"]);
const VALID_VERDICTS = new Set(["correct", "false-positive"]);

router.post("/feedback", feedbackLimiter, (req, res) => {
  const body = req.body ?? {};
  const donator = asString(body.donator);
  const message = asString(body.message);
  const decision = asString(body.decision);
  const verdict = asString(body.verdict);

  if (!VALID_DECISIONS.has(decision) || !VALID_VERDICTS.has(verdict)) {
    return res.status(400).json({ error: "Invalid decision or verdict" });
  }

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  logFeedback({ donator, message, decision, verdict });
  logger.info("feedback", decision, verdict, `"${donator}" :: "${message}"`);

  res.json({ ok: true });
});

export default router;
