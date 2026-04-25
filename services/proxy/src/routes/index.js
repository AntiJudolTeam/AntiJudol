import express from "express";
import staticRoutes from "./web/static.js";
import checkRoutes from "./api/check.js";
import feedbackRoutes from "./api/feedback.js";
import overlayRoutes from "./proxy/overlay.js";
import backendRoutes from "./proxy/backend.js";
import assetRoutes from "./proxy/assets.js";
import { JSON_BODY_LIMIT } from "../config.js";

const router = express.Router();
router.use(express.json({ limit: JSON_BODY_LIMIT }));

// Specific routes before the catch-all asset proxy.
router.use("/", staticRoutes);
router.use("/", checkRoutes);
router.use("/", feedbackRoutes);
router.use("/", overlayRoutes);
router.use("/", backendRoutes);

// Absorb CF challenge endpoints so they don't fall through to the asset proxy.
router.all("/cdn-cgi/*", (_req, res) => {
  res.status(200).send("// CF challenge bypassed");
});

router.use("/", assetRoutes);

export default router;
