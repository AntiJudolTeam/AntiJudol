import express from "express";
import { fetchViaAntibot } from "../../antibot/index.js";
import { logger } from "../../utils/logger.js";
import { resolvePlatform } from "../../utils/platformMiddleware.js";
import { BACKEND_PREFIX } from "../../constants.js";

const router = express.Router();

router.use(
  `${BACKEND_PREFIX}/:platform`,
  resolvePlatform({ source: (req) => req.params.platform }),
  async (req, res) => {
    const { platform, platformName } = req;
    const streamKey = req.query.streamKey || req.headers["stream-key"];
    const overlayType = req.query.overlayType || "";
    if (!streamKey) return res.status(400).send("Missing streamKey");

    try {
      const backendPath = req.originalUrl
        .replace(`${BACKEND_PREFIX}/${platformName}`, "")
        .replace(/([?&])streamKey=[^&]*&?/, "$1")
        .replace(/([?&])overlayType=[^&]*&?/, "$1")
        .replace(/[?&]$/, "");

      const targetUrl = new URL(platform.backendOrigin).origin + backendPath;
      logger.debug("backend", req.method, platformName, targetUrl);

      const headers = platform.backendHeaders({ streamKey, overlayType });
      if (platform.forwardHeaders) {
        for (const h of platform.forwardHeaders) {
          const val = req.headers[h.toLowerCase()];
          if (val) headers[h] = val;
        }
      }

      if (platform.useImpersonate) {
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const antibotHeaders = { ...headers };
        const clientContentType = req.headers["content-type"];
        if (hasBody && clientContentType) antibotHeaders["Content-Type"] = clientContentType;

        const result = await fetchViaAntibot(targetUrl, {
          method: req.method,
          headers: antibotHeaders,
          body: hasBody ? req.body : null,
        });
        res.setHeader("Content-Type", result.contentType);
        return res.status(result.status).send(result.rawBody);
      }

      const response = await fetch(targetUrl, { method: req.method, headers });
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.status(response.status);
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      logger.error("backend", req.originalUrl, err.message);
      res.status(502).send("Failed to proxy backend");
    }
  }
);

export default router;
