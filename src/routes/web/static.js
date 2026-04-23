import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "../../..", "public");
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
