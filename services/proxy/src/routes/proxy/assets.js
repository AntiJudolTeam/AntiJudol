import express from "express";
import { getPlatform } from "../../platforms.js";
import { fetchViaAntibot } from "../../antibot/index.js";
import { getPlatformFromCookie, getPlatformFromReferer } from "../../utils/helpers.js";
import { logger } from "../../utils/logger.js";
import { MIME_TYPES, TEXT_ASSET_EXTENSIONS } from "../../constants.js";
import { DEFAULT_PLATFORM } from "../../config.js";

const router = express.Router();

function refererMatchesHost(req) {
  const referer = req.headers.referer;
  if (!referer) return false;
  try {
    return new URL(referer).host === req.headers.host;
  } catch {
    return false;
  }
}

function resolvePlatformFromRequest(req) {
  const requestedName = getPlatformFromCookie(req) || getPlatformFromReferer(req) || DEFAULT_PLATFORM;
  try {
    return getPlatform(requestedName);
  } catch {
    return getPlatform(DEFAULT_PLATFORM);
  }
}

router.use(async (req, res) => {
  if (!refererMatchesHost(req)) {
    return res.status(404).type("text/plain").send("Not Found");
  }

  const platform = resolvePlatformFromRequest(req);

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
