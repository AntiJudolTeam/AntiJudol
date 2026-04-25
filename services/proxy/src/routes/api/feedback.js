import express from "express";
import { logger } from "../../utils/logger.js";
import { logFeedback } from "../../utils/feedbackLog.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { asString } from "../../utils/validation.js";
import { FEEDBACK_RATE_MAX, FEEDBACK_RATE_WINDOW_MS } from "../../config.js";
import { FEEDBACK_ENDPOINT } from "../../constants.js";

const router = express.Router();

const VALID_DECISIONS = new Set(["block", "allow"]);
const VALID_VERDICTS = new Set(["correct", "false-positive"]);

const feedbackLimiter = createRateLimiter({
  windowMs: FEEDBACK_RATE_WINDOW_MS,
  max: FEEDBACK_RATE_MAX,
  name: "feedback-rl",
});

router.post(FEEDBACK_ENDPOINT, feedbackLimiter, (req, res) => {
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
  logger.info("feedback", `${decision}/${verdict} donator="${donator}" msg="${message}"`);

  return res.json({ ok: true });
});

export default router;
