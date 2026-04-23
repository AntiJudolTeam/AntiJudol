import { describe, test, expect, mock } from "bun:test";
import { createRateLimiter } from "../src/utils/rateLimit.js";

function mockReq(ip = "1.1.1.1") {
  return { ip, socket: { remoteAddress: ip } };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
  };
  return res;
}

describe("createRateLimiter", () => {
  test("allows requests under the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const next = mock();
    for (let i = 0; i < 3; i++) limiter(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  test("blocks the (max+1)th request with 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = mock();
    limiter(mockReq(), mockRes(), next);
    limiter(mockReq(), mockRes(), next);
    const res = mockRes();
    limiter(mockReq(), res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe("Too many requests");
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(res.headers["Retry-After"]).toBeDefined();
  });

  test("tracks IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const nextA = mock();
    const nextB = mock();
    limiter(mockReq("1.1.1.1"), mockRes(), nextA);
    limiter(mockReq("2.2.2.2"), mockRes(), nextB);
    expect(nextA).toHaveBeenCalled();
    expect(nextB).toHaveBeenCalled();
  });

  test("resets after the window elapses", async () => {
    const limiter = createRateLimiter({ windowMs: 50, max: 1 });
    const res1 = mockRes();
    const res2 = mockRes();
    const res3 = mockRes();
    const next = mock();
    limiter(mockReq(), res1, next);
    limiter(mockReq(), res2, next);
    expect(res2.statusCode).toBe(429);

    await new Promise((r) => setTimeout(r, 70));
    limiter(mockReq(), res3, next);
    expect(res3.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("falls back to socket.remoteAddress when req.ip missing", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = mock();
    const req = { socket: { remoteAddress: "3.3.3.3" } };
    limiter(req, mockRes(), next);
    const res = mockRes();
    limiter(req, res, next);
    expect(res.statusCode).toBe(429);
  });
});
