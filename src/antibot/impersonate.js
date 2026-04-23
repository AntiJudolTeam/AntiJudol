import { createCuimpHttp, downloadBinary } from "cuimp";
import { logger } from "../utils/logger.js";

const cuimpLogger = {
  debug: () => {},
  info: () => {},
  warn: (...args) => logger.warn("impersonate", ...args),
  error: (...args) => logger.error("impersonate", ...args),
};

const BASE_OPTIONS = {
  descriptor: { browser: "chrome" },
  cookieJar: true,
  extraCurlArgs: ["--impersonate", "chrome116", "--compressed"],
  logger: cuimpLogger,
};

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const info = await downloadBinary(BASE_OPTIONS);
      logger.info("impersonate", "binary ready", info.binaryPath);
      return createCuimpHttp({ ...BASE_OPTIONS, path: info.binaryPath });
    })();
  }
  return clientPromise;
}

export async function ensureImpersonateReady() {
  await getClient();
}

export async function fetchViaImpersonate(url, { method = "GET", headers = {}, body = null } = {}) {
  const client = await getClient();
  const requestConfig = { url, method, headers };
  if (body != null && method !== "GET" && method !== "HEAD") {
    requestConfig.data = body;
  }

  const res = await client.request(requestConfig);
  const bytes = res.rawBody ? res.rawBody.length : 0;
  logger.debug("impersonate", method, url, "status=" + res.status, "bytes=" + bytes);

  const rawBody = res.rawBody ?? null;
  const data = rawBody ? rawBody.toString("utf8") : typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  return {
    data,
    rawBody,
    contentType: res.headers["content-type"] || "text/html",
    status: res.status,
  };
}
