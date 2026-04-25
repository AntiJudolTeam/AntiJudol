import express from "express";
import { decide } from "../../filter/judolFilter.js";
import { classify } from "../../filter/classifier.js";
import { logger } from "../../utils/logger.js";
import { logDonation } from "../../utils/donationLog.js";
import { isKillSwitchActive } from "../../utils/killSwitch.js";
import { asString, asNumberOrNull } from "../../utils/validation.js";
import { BLOCK_DONATOR_REPLACEMENT, BLOCK_MESSAGE_REPLACEMENT, FILTER_METHOD } from "../../config.js";
import { CHECK_ENDPOINT } from "../../constants.js";

const router = express.Router();

const VALIDATE_PLATFORM = "validate";

// Get the classifier's raw gambling probability without coercing it to a
// block/allow verdict. Returns null on any failure so the algorithm can run
// standalone.
async function classifierGambling(donator, message) {
  try {
    const result = await classify(donator, message);
    return typeof result.gambling === "number" ? result.gambling : null;
  } catch (err) {
    logger.warn("classifier", "skipped:", err.message);
    return null;
  }
}

async function getDecision(donator, message) {
  if (FILTER_METHOD === "algorithm") {
    return decide(donator, message);
  }

  if (FILTER_METHOD === "classifier") {
    try {
      return await classify(donator, message);
    } catch (err) {
      logger.warn("classifier", "fallback to algorithm:", err.message);
      return decide(donator, message);
    }
  }

  // "both" — run algorithm + classifier in parallel; fold the classifier's
  // gambling probability into the algorithm score for a single combined verdict.
  const gambling = await classifierGambling(donator, message);
  return decide(donator, message, { classifierGambling: gambling });
}

function summary(action, stage) {
  if (action === "block") return `block:${stage}`;
  if (action === "review") return `review:${stage}`;
  return `allow:${stage}`;
}

router.post(CHECK_ENDPOINT, async (req, res) => {
  const body = req.body ?? {};
  const platform = asString(body.platform);
  const donator = asString(body.donator);
  const message = asString(body.message);
  const amount = asNumberOrNull(body.amount);
  const currency = asString(body.currency);
  const isValidationCheck = platform === VALIDATE_PLATFORM;

  if (isKillSwitchActive()) {
    if (!isValidationCheck) logDonation({ donator, message, killed: true });
    logger.info("check", `${platform || "?"} killed donator="${donator}" msg="${message}"`);
    return res.json({ action: "allow" });
  }

  const decision = await getDecision(donator, message);
  if (!isValidationCheck) logDonation({ donator, message, decision });

  const tag = summary(decision.action, decision.stage);
  const amountStr = amount != null ? `${currency || "?"}${amount}` : "-";
  logger.info("check", `${platform || "?"} ${tag} ${amountStr} donator="${donator}" msg="${message}"`);

  if (decision.action === "block") {
    return res.json({
      action: "block",
      replaceDonator: BLOCK_DONATOR_REPLACEMENT,
      replaceMessage: BLOCK_MESSAGE_REPLACEMENT,
    });
  }
  return res.json({ action: "allow" });
});

export default router;
