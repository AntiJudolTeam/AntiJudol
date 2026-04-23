import { describe, test, expect } from "bun:test";
import { getPlatformFromCookie, getPlatformFromReferer, injectScripts } from "../src/utils/helpers.js";

function mockReq({ cookie = "", referer = "", host = "localhost:3000" } = {}) {
  return { headers: { cookie, referer, host } };
}

describe("getPlatformFromCookie", () => {
  test("extracts platform from cookie header", () => {
    expect(getPlatformFromCookie(mockReq({ cookie: "antijudol_platform=saweria" }))).toBe("saweria");
  });

  test("extracts platform when among multiple cookies", () => {
    const cookie = "session=abc; antijudol_platform=bagibagi; other=xyz";
    expect(getPlatformFromCookie(mockReq({ cookie }))).toBe("bagibagi");
  });

  test("returns null when cookie header missing", () => {
    expect(getPlatformFromCookie({ headers: {} })).toBeNull();
  });

  test("returns null when cookie doesn't contain our key", () => {
    expect(getPlatformFromCookie(mockReq({ cookie: "session=abc; foo=bar" }))).toBeNull();
  });

  test("returns null when cookie is empty string", () => {
    expect(getPlatformFromCookie(mockReq({ cookie: "" }))).toBeNull();
  });

  test("captures word chars only (stops at non-word)", () => {
    expect(getPlatformFromCookie(mockReq({ cookie: "antijudol_platform=tako;path=/" }))).toBe("tako");
  });
});

describe("getPlatformFromReferer", () => {
  test("extracts platform query param from referer URL", () => {
    const referer = "http://localhost:3000/overlay?platform=sociabuzz&streamKey=abc";
    expect(getPlatformFromReferer(mockReq({ referer }))).toBe("sociabuzz");
  });

  test("returns null when referer has no platform param", () => {
    const referer = "http://localhost:3000/overlay?streamKey=abc";
    expect(getPlatformFromReferer(mockReq({ referer }))).toBeNull();
  });

  test("returns null when referer header missing", () => {
    expect(getPlatformFromReferer({ headers: { host: "localhost:3000" } })).toBeNull();
  });

  test("handles relative referer by resolving against host", () => {
    const referer = "/overlay?platform=tako&streamKey=xyz";
    expect(getPlatformFromReferer(mockReq({ referer }))).toBe("tako");
  });

  test("returns null for malformed referer without throwing", () => {
    expect(getPlatformFromReferer(mockReq({ referer: "not a url", host: "" }))).toBeNull();
  });
});

const basePlatform = {
  backendOrigin: "https://backend.saweria.co",
  backendPathPrefix: null,
  useImpersonate: false,
};

const cfPlatform = {
  backendOrigin: "https://bagibagi.co/api",
  backendPathPrefix: "/api",
  useImpersonate: true,
};

describe("injectScripts: non-CF platforms", () => {
  const html = `<html><head><title>x</title></head><body></body></html>`;

  test("inserts external <script src=\"/inject.js\"> before </head>", () => {
    const out = injectScripts(html, basePlatform, "saweria", "alert", "KEY", "/widgets/alert?streamKey=KEY");
    expect(out).toContain('<script src="/inject.js"></script>');
    expect(out).toContain("</head>");
    expect(out.indexOf('<script src="/inject.js">')).toBeLessThan(out.indexOf("</head>"));
  });

  test("embeds platform name and streamKey in config block", () => {
    const out = injectScripts(html, basePlatform, "saweria", "alert", "KEY-123", "/widgets/alert");
    expect(out).toContain('platform: "saweria"');
    expect(out).toContain('streamKey: "KEY-123"');
  });

  test("sets cookie via document.cookie in config block", () => {
    const out = injectScripts(html, basePlatform, "saweria", "alert", "KEY", "/x");
    expect(out).toContain("document.cookie = 'antijudol_platform=saweria; path=/'");
  });

  test("invokes history.replaceState with clientPath", () => {
    const out = injectScripts(html, basePlatform, "saweria", "alert", "KEY", "/widgets/alert?streamKey=KEY");
    expect(out).toContain('history.replaceState(null, \'\', "/widgets/alert?streamKey=KEY")');
  });

  test("emits backendOrigin and null backendPathPrefix for same-origin platforms", () => {
    const out = injectScripts(html, basePlatform, "saweria", "alert", "KEY", "/x");
    expect(out).toContain('backendOrigin: "https://backend.saweria.co"');
    expect(out).toContain("backendPathPrefix: null");
  });

  test("uses empty string when overlayType omitted", () => {
    const out = injectScripts(html, basePlatform, "saweria", "", "KEY", "/x");
    expect(out).toContain('overlayType: ""');
  });
});

describe("injectScripts: CF-protected platforms", () => {
  const html = `<html><head lang="en"><title>x</title></head><body></body></html>`;

  test("inlines script inside <head> with data-cfasync=\"false\"", () => {
    const out = injectScripts(html, cfPlatform, "bagibagi", "alertbox", "K", "/alertbox/K");
    expect(out).toContain('<script data-cfasync="false">');
    expect(out).not.toContain('<script src="/inject.js">');
  });

  test("inlined block appears immediately after opening <head>", () => {
    const out = injectScripts(html, cfPlatform, "bagibagi", "alertbox", "K", "/alertbox/K");
    const headOpen = out.indexOf("<head");
    const headClose = out.indexOf(">", headOpen);
    const injected = out.indexOf("<script data-cfasync=");
    expect(injected).toBe(headClose + 1);
  });

  test("includes the bundled inject.js body inline", () => {
    const out = injectScripts(html, cfPlatform, "bagibagi", "alertbox", "K", "/alertbox/K");
    expect(out).toContain("XMLHttpRequest");
    expect(out).toContain("WebSocket");
  });

  test("preserves <head> attributes when injecting", () => {
    const out = injectScripts(html, cfPlatform, "bagibagi", "alertbox", "K", "/alertbox/K");
    expect(out).toContain('<head lang="en">');
  });

  test("emits backendPathPrefix for same-origin API", () => {
    const out = injectScripts(html, cfPlatform, "bagibagi", "alertbox", "K", "/alertbox/K");
    expect(out).toContain('backendPathPrefix: "/api"');
  });
});
