import express from "express";
import { getPlatform } from "../../platforms.js";
import { fetchViaAntibot } from "../../antibot/index.js";
import { getPlatformFromCookie, getPlatformFromReferer } from "../../utils/helpers.js";
import { logger } from "../../utils/logger.js";
import { MIME_TYPES, TEXT_ASSET_EXTENSIONS } from "../../constants.js";

const router = express.Router();
const DEFAULT_PLATFORM = "saweria";

function refererMatchesHost(req) {
  const referer = req.headers.referer;
  if (!referer) return false;
  try {
    return new URL(referer).host === req.headers.host;
  } catch {
    return false;
  }
}

router.use(async (req, res) => {
  if (!refererMatchesHost(req)) {
    return res.status(404).type("text/plain").send("Not Found");
  }

  const requestedName = getPlatformFromCookie(req) || getPlatformFromReferer(req) || DEFAULT_PLATFORM;

  let platform;
  try {
    platform = getPlatform(requestedName);
  } catch {
    platform = getPlatform(DEFAULT_PLATFORM);
  }

  try {
    const targetUrl = platform.assetOrigin + req.originalUrl;
    const response = await fetch(targetUrl, { headers: platform.assetHeaders() });

    if (response.status === 403 && platform.useImpersonate) {
      const ext = req.path.split(".").pop();
      if (TEXT_ASSET_EXTENSIONS.includes(ext)) {
        const result = await fetchViaAntibot(targetUrl);
        res.setHeader("Content-Type", MIME_TYPES[ext] || "text/plain");
        return res.send(result.rawBody ?? result.data);
      }
    }

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);

    res.status(response.status);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    logger.error("assets", req.originalUrl, err.message);
    res.status(502).send("Failed to proxy asset");
  }
});

export default router;
