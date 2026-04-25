import { describe, test, expect, beforeAll, afterAll } from "bun:test";

let server;
let baseUrl;
let mockResponse = null;
let mockStatus = 200;
let requestLog = [];

const express = (await import("express")).default;
const app = express();
app.use(express.json());
app.post("/api/v1/classify/predict", (req, res) => {
  requestLog.push({ body: req.body });
  if (mockStatus !== 200) {
    res.status(mockStatus).json({ status: false, message: "mock error" });
    return;
  }
  res.json(mockResponse);
});

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      // Must set BEFORE importing classifier (config.js reads at module-load)
      process.env.PROXY_FILTER_URL = baseUrl;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function setMock({ label = 0, gambling = 0.1, normal = 0.9, status = 200 } = {}) {
  mockStatus = status;
  mockResponse = {
    status: true,
    data: { text: "stub", label, normal, gambling },
    message: "Success",
    errors: null,
    timestamp: new Date().toISOString(),
  };
  requestLog = [];
}

describe("classifier client", () => {
  test("returns block when label=1", async () => {
    setMock({ label: 1, gambling: 0.95, normal: 0.05 });
    const { classify } = await import("../src/filter/classifier.js");
    const result = await classify("viewer", "slot gacor maxwin");
    expect(result.action).toBe("block");
    expect(result.stage).toBe("classifier");
    expect(result.reason).toContain("score=0.9500");
  });

  test("returns allow when label=0", async () => {
    setMock({ label: 0, gambling: 0.02, normal: 0.98 });
    const { classify } = await import("../src/filter/classifier.js");
    const result = await classify("fan", "makasih bang streamnya seru");
    expect(result.action).toBe("allow");
    expect(result.stage).toBe("classifier");
    expect(result.reason).toContain("score=0.0200");
  });

  test("concatenates donator and message into text payload", async () => {
    setMock({ label: 1, gambling: 0.8 });
    const { classify } = await import("../src/filter/classifier.js");
    await classify("kantorbola99", "halo");
    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].body.text).toBe("kantorbola99 halo");
  });

  test("normalizes uppercase + ornaments before sending to classifier", async () => {
    setMock({ label: 1, gambling: 0.95 });
    const { classify } = await import("../src/filter/classifier.js");
    await classify("xKANTORBOLA", "KANTORBOLA99.ART | BAGI BAGI FREECHIP 100RB TIAP HARI | DAFTAR SEKARANG");
    expect(requestLog).toHaveLength(1);
    const sent = requestLog[0].body.text;
    expect(sent).not.toContain("|");
    expect(sent).toBe(sent.toLowerCase());
    expect(sent).toContain("kantorbola");
    expect(sent).toContain("freechip");
  });

  test("returns allow without calling filter when both fields empty", async () => {
    setMock({ label: 1 });
    const { classify } = await import("../src/filter/classifier.js");
    const result = await classify("", "");
    expect(result.action).toBe("allow");
    expect(result.reason).toBe("empty-input");
    expect(requestLog).toHaveLength(0);
  });

  test("throws on non-200 status from filter", async () => {
    setMock({ status: 500 });
    const { classify } = await import("../src/filter/classifier.js");
    await expect(classify("viewer", "test")).rejects.toThrow(/classifier returned 500/);
  });

  test("throws on malformed response (missing data)", async () => {
    mockStatus = 200;
    mockResponse = { status: true, message: "ok" }; // no `data`
    const { classify } = await import("../src/filter/classifier.js");
    await expect(classify("viewer", "test")).rejects.toThrow(/missing status\/data/);
  });

  test("throws on response with status=false", async () => {
    mockStatus = 200;
    mockResponse = { status: false, data: null, message: "fail" };
    const { classify } = await import("../src/filter/classifier.js");
    await expect(classify("viewer", "test")).rejects.toThrow(/missing status\/data/);
  });

  test("throws on invalid label value", async () => {
    setMock({ label: 7, gambling: 0.5 });
    const { classify } = await import("../src/filter/classifier.js");
    await expect(classify("viewer", "test")).rejects.toThrow(/invalid label: 7/);
  });

  test("trims whitespace-only input to empty", async () => {
    const { classify } = await import("../src/filter/classifier.js");
    requestLog = [];
    const result = await classify("  ", "  ");
    expect(result.action).toBe("allow");
    expect(result.reason).toBe("empty-input");
    expect(requestLog).toHaveLength(0);
  });
});
