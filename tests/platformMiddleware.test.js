import { describe, test, expect, mock } from "bun:test";
import { resolvePlatform } from "../src/utils/platformMiddleware.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe("resolvePlatform: default source (query → params)", () => {
  test("attaches platform from query.platform", () => {
    const mw = resolvePlatform();
    const req = { query: { platform: "saweria" }, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.platform).toBeDefined();
    expect(req.platform.name).toBe("Saweria");
    expect(req.platformName).toBe("saweria");
  });

  test("falls back to params.platform when query missing", () => {
    const mw = resolvePlatform();
    const req = { query: {}, params: { platform: "tako" } };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.platformName).toBe("tako");
  });
});

describe("resolvePlatform: missing name", () => {
  test("returns 400 when required and name missing", () => {
    const mw = resolvePlatform();
    const req = { query: {}, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe("Missing platform");
  });

  test("calls next with req.platform = null when optional", () => {
    const mw = resolvePlatform({ optional: true });
    const req = { query: {}, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.platform).toBeNull();
    expect(res.statusCode).toBe(200);
  });
});

describe("resolvePlatform: unknown platform", () => {
  test("returns 400 with descriptive error", () => {
    const mw = resolvePlatform();
    const req = { query: { platform: "nonexistent" }, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Unknown platform "nonexistent"');
    expect(res.body).toContain("saweria");
  });

  test("optional flag does not rescue unknown platform (still 400)", () => {
    const mw = resolvePlatform({ optional: true });
    const req = { query: { platform: "nope" }, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});

describe("resolvePlatform: custom source", () => {
  test("uses provided source function", () => {
    const mw = resolvePlatform({ source: (req) => req.headers["x-platform"] });
    const req = { headers: { "x-platform": "sociabuzz" }, query: {}, params: {} };
    const res = mockRes();
    const next = mock();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.platformName).toBe("sociabuzz");
  });
});
