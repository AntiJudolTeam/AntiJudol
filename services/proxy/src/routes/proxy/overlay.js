import express from "express";
import { fetchViaAntibot } from "../../antibot/index.js";
import { injectScripts } from "../../utils/helpers.js";
import { logger } from "../../utils/logger.js";
import { resolvePlatform } from "../../utils/platformMiddleware.js";
import { stripCloudflareArtifacts } from "../../utils/cfStrip.js";
import { COOKIE_PLATFORM } from "../../constants.js";

const router = express.Router();

export function rewriteSaweriaWidgets(req, res, next) {
  const streamKey = req.query.streamKey;
  if (!streamKey) return res.status(400).send("Missing streamKey");
  req.url = `/overlay?platform=saweria&overlayType=${req.params.overlayType}&streamKey=${streamKey}`;
  req.query = { platform: "saweria", overlayType: req.params.overlayType, streamKey };
  next();
}

export function rewriteTakoOverlay(req, res, next) {
  const streamKey = req.query.overlay_key;
  if (!streamKey) return next();
  req.url = `/overlay?platform=tako&overlayType=${req.params.overlayType}&streamKey=${streamKey}`;
  req.query = { platform: "tako", overlayType: req.params.overlayType, streamKey };
  next();
}

export function rewriteBagiBagiAlertbox(req, res, next) {
  req.url = `/overlay?platform=bagibagi&streamKey=${req.params.streamKey}`;
  req.query = { platform: "bagibagi", streamKey: req.params.streamKey };
  next();
}

export function rewriteSociabuzzAlert(req, res, next) {
  req.query = {
    ...req.query,
    platform: "sociabuzz",
    overlayType: "alert",
    streamKey: req.params.streamKey,
  };
  req.url = "/overlay?" + new URLSearchParams(req.query).toString();
  next();
}

export function rewriteSociabuzzMediashare(req, res, next) {
  req.query = {
    ...req.query,
    platform: "sociabuzz",
    overlayType: "mediashare",
    streamKey: req.params.streamKey,
  };
  req.url = "/overlay?" + new URLSearchParams(req.query).toString();
  next();
}

router.get("/widgets/:overlayType", rewriteSaweriaWidgets);
router.get("/overlay/:overlayType", rewriteTakoOverlay);
router.get("/alertbox/:streamKey", rewriteBagiBagiAlertbox);
router.get("/pro/tribe/alert1/v3/:streamKey", rewriteSociabuzzAlert);
router.get("/pro/tribe/mediashare/v2/:streamKey", rewriteSociabuzzMediashare);

const RESERVED_OVERLAY_PARAMS = new Set(["platform", "overlayType", "streamKey"]);

router.get("/overlay", resolvePlatform(), async (req, res) => {
  const { overlayType, streamKey } = req.query;
  if (!streamKey) return res.status(400).send("Missing required query param: streamKey");

  const { platform, platformName } = req;

  try {
    const extra = Object.entries(req.query)
      .filter(([k]) => !RESERVED_OVERLAY_PARAMS.has(k))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const overlayUrl = platform.overlayUrl({ streamKey, overlayType, extraParams: extra });
    logger.debug("overlay", platformName, overlayUrl);

    let html;
    if (platform.useImpersonate) {
      const result = await fetchViaAntibot(overlayUrl);
      html = stripCloudflareArtifacts(result.data, platform.assetOrigin);
    } else {
      const response = await fetch(overlayUrl, { headers: platform.assetHeaders() });
      html = await response.text();
    }

    const clientUrl = new URL(overlayUrl);
    const clientPath = clientUrl.pathname + clientUrl.search;
    html = injectScripts(html, platform, platformName, overlayType, streamKey, clientPath);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Set-Cookie", `${COOKIE_PLATFORM}=${platformName}; Path=/`);
    res.send(html);
  } catch (err) {
    logger.error("overlay", err.message);
    res.status(502).send("Failed to fetch overlay");
  }
});

export default router;
