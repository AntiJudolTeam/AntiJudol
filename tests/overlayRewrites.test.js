import { describe, test, expect, mock } from "bun:test";
import {
  rewriteSaweriaWidgets,
  rewriteTakoOverlay,
  rewriteBagiBagiAlertbox,
  rewriteSociabuzzAlert,
  rewriteSociabuzzMediashare,
} from "../src/routes/proxy/overlay.js";

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

describe("rewriteSaweriaWidgets", () => {
  test("rewrites /widgets/alert?streamKey=X to /overlay?...", () => {
    const req = { params: { overlayType: "alert" }, query: { streamKey: "abc" } };
    const res = mockRes();
    const next = mock();
    rewriteSaweriaWidgets(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.url).toBe("/overlay?platform=saweria&overlayType=alert&streamKey=abc");
    expect(req.query).toEqual({ platform: "saweria", overlayType: "alert", streamKey: "abc" });
  });

  test("returns 400 when streamKey missing", () => {
    const req = { params: { overlayType: "alert" }, query: {} };
    const res = mockRes();
    const next = mock();
    rewriteSaweriaWidgets(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe("Missing streamKey");
  });

  test("supports mediashare overlay type", () => {
    const req = { params: { overlayType: "mediashare" }, query: { streamKey: "k" } };
    const res = mockRes();
    const next = mock();
    rewriteSaweriaWidgets(req, res, next);
    expect(req.url).toContain("overlayType=mediashare");
  });
});

describe("rewriteTakoOverlay", () => {
  test("rewrites /overlay/alert?overlay_key=X to /overlay?...", () => {
    const req = { params: { overlayType: "alert" }, query: { overlay_key: "xyz" } };
    const res = mockRes();
    const next = mock();
    rewriteTakoOverlay(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.url).toBe("/overlay?platform=tako&overlayType=alert&streamKey=xyz");
    expect(req.query.platform).toBe("tako");
    expect(req.query.streamKey).toBe("xyz");
  });

  test("falls through without rewrite when overlay_key absent", () => {
    const originalUrl = "/overlay/alert";
    const req = { params: { overlayType: "alert" }, query: {}, url: originalUrl };
    const res = mockRes();
    const next = mock();
    rewriteTakoOverlay(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.url).toBe(originalUrl);
    expect(req.query).toEqual({});
  });
});

describe("rewriteBagiBagiAlertbox", () => {
  test("rewrites /alertbox/KEY to /overlay?platform=bagibagi&streamKey=KEY", () => {
    const req = { params: { streamKey: "KEY" }, query: {} };
    const res = mockRes();
    const next = mock();
    rewriteBagiBagiAlertbox(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.url).toBe("/overlay?platform=bagibagi&streamKey=KEY");
    expect(req.query).toEqual({ platform: "bagibagi", streamKey: "KEY" });
  });
});

describe("rewriteSociabuzzAlert", () => {
  test("rewrites alert path and preserves extra styling params", () => {
    const req = {
      params: { streamKey: "KEY" },
      query: { fontColor: "white", bgColor: "black" },
    };
    const res = mockRes();
    const next = mock();
    rewriteSociabuzzAlert(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.platform).toBe("sociabuzz");
    expect(req.query.overlayType).toBe("alert");
    expect(req.query.streamKey).toBe("KEY");
    expect(req.query.fontColor).toBe("white");
    expect(req.query.bgColor).toBe("black");
    expect(req.url).toContain("fontColor=white");
    expect(req.url).toContain("bgColor=black");
    expect(req.url).toContain("platform=sociabuzz");
  });

  test("works with no extra params", () => {
    const req = { params: { streamKey: "K" }, query: {} };
    const res = mockRes();
    const next = mock();
    rewriteSociabuzzAlert(req, res, next);
    expect(req.url).toBe("/overlay?platform=sociabuzz&overlayType=alert&streamKey=K");
  });
});

describe("rewriteSociabuzzMediashare", () => {
  test("rewrites mediashare path with overlayType=mediashare", () => {
    const req = { params: { streamKey: "K" }, query: {} };
    const res = mockRes();
    const next = mock();
    rewriteSociabuzzMediashare(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.overlayType).toBe("mediashare");
    expect(req.url).toContain("overlayType=mediashare");
  });

  test("preserves extra query params (styling)", () => {
    const req = { params: { streamKey: "K" }, query: { theme: "dark" } };
    const res = mockRes();
    const next = mock();
    rewriteSociabuzzMediashare(req, res, next);
    expect(req.url).toContain("theme=dark");
  });
});
