import express from "express";
import { PUBLIC_DIR } from "../../utils/paths.js";

const router = express.Router();

router.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json");
      }
    },
  })
);

export default router;
