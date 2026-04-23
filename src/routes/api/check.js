import express from "express";
import { decide } from "../../filter/judolFilter.js";
import { logger } from "../../utils/logger.js";
import { logDonation } from "../../utils/donationLog.js";
import { isKillSwitchActive } from "../../utils/killSwitch.js";
import { CHECK_ENDPOINT, BLOCK_DONATOR_REPLACEMENT, BLOCK_MESSAGE_REPLACEMENT } from "../../constants.js";

const router = express.Router();

const MAX_FIELD_LENGTH = 4096;

function asString(value) {
  if (value == null) return "";
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_FIELD_LENGTH);
}

router.post(CHECK_ENDPOINT, async (req, res) => {
  const body = req.body ?? {};
  const platform = asString(body.platform);
  const donator = asString(body.donator);
  const message = asString(body.message);
  const amount = typeof body.amount === "number" ? body.amount : null;
  const currency = asString(body.currency);

  logger.info("check", platform, `${donator} | ${currency} ${amount ?? ""} | ${message}`);

  const isValidationCheck = platform === "validate";

  if (isKillSwitchActive()) {
    if (!isValidationCheck) logDonation({ donator, message, killed: true });
    res.json({ action: "allow" });
    return;
  }

  const decision = decide(donator, message);
  const { action, stage, reason } = decision;
  if (!isValidationCheck) logDonation({ donator, message, decision });

  if (action === "block") {
    logger.info("blocked", stage, platform, donator, message, reason);
    res.json({
      action: "block",
      replaceDonator: BLOCK_DONATOR_REPLACEMENT,
      replaceMessage: BLOCK_MESSAGE_REPLACEMENT,
    });
    return;
  }
  res.json({ action: "allow" });
});

export default router;
