import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KILLSWITCH_NAME = ".killswitch-integration-test";
const KILLSWITCH_PATH = path.resolve(__dirname, "..", KILLSWITCH_NAME);

process.env.PROXY_KILL_SWITCH_PATH = KILLSWITCH_NAME;
process.env.PROXY_LOG_LEVEL = "error";

try {
  fs.unlinkSync(KILLSWITCH_PATH);
} catch {
  /* not present */
}

const express = (await import("express")).default;
const checkRoutes = (await import("../src/routes/api/check.js")).default;

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use("/", checkRoutes);

let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  try {
    fs.unlinkSync(KILLSWITCH_PATH);
  } catch {
    /* not present */
  }
  await new Promise((resolve) => server.close(resolve));
});

async function postCheck(body) {
  const res = await fetch(`${baseUrl}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe("POST /check: block/allow", () => {
  test("blocks obvious judol message", async () => {
    const { status, body } = await postCheck({
      platform: "saweria",
      donator: "viewer",
      message: "slot gacor hari ini",
      amount: 10000,
      currency: "IDR",
    });
    expect(status).toBe(200);
    expect(body.action).toBe("block");
    expect(body.replaceDonator).toBe("Anonymous");
    expect(body.replaceMessage).toContain("AntiJudol");
  });

  test("allows clean donation", async () => {
    const { body } = await postCheck({
      platform: "saweria",
      donator: "fan",
      message: "makasih bang streamnya seru",
      amount: 5000,
      currency: "IDR",
    });
    expect(body.action).toBe("allow");
    expect(body.replaceDonator).toBeUndefined();
  });

  test("allows empty payload", async () => {
    const { body } = await postCheck({});
    expect(body.action).toBe("allow");
  });

  test("allows when fields are non-string", async () => {
    const { body } = await postCheck({
      platform: 42,
      donator: { injected: "object" },
      message: ["array"],
    });
    expect(body.action).toBe("allow");
  });

  test("truncates oversize message before deciding", async () => {
    const huge = "a".repeat(10_000);
    const { status, body } = await postCheck({
      platform: "saweria",
      donator: "x",
      message: huge,
      amount: 1,
    });
    expect(status).toBe(200);
    expect(body.action).toBe("allow");
  });

  test("blocks brand name even in donator field via message", async () => {
    const { body } = await postCheck({
      platform: "saweria",
      donator: "viewer",
      message: "kantorbola99 daftar sekarang bonus",
    });
    expect(body.action).toBe("block");
  });
});

describe("POST /check: kill switch", () => {
  test("allows judol message when kill-switch file is present", async () => {
    fs.writeFileSync(KILLSWITCH_PATH, "");
    // TTL inside killSwitch.js is 2000ms; wait past it before the cache re-checks.
    await new Promise((r) => setTimeout(r, 2100));

    const { body } = await postCheck({
      platform: "saweria",
      donator: "viewer",
      message: "slot gacor maxwin bonus",
    });
    expect(body.action).toBe("allow");
  });

  test("resumes blocking after kill-switch file removed", async () => {
    fs.unlinkSync(KILLSWITCH_PATH);
    await new Promise((r) => setTimeout(r, 2100));

    const { body } = await postCheck({
      platform: "saweria",
      donator: "viewer",
      message: "slot gacor maxwin bonus",
    });
    expect(body.action).toBe("block");
  });
});
