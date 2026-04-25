import express from "express";
import routes from "./routes/index.js";
import { HOST, PORT, validateConfig } from "./config.js";
import { ensureImpersonateReady } from "./antibot/impersonate.js";
import { logger } from "./utils/logger.js";

validateConfig();
await ensureImpersonateReady();

const app = express();
app.use("/", routes);
app.listen(PORT, HOST, () => {
  logger.info("server", `AntiJudol running at http://${HOST}:${PORT}`);
});
