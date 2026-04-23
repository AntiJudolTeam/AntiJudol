import { describe, test, expect } from "bun:test";
import { stripCloudflareArtifacts } from "../src/utils/cfStrip.js";

describe("stripCloudflareArtifacts: script tag removal", () => {
  test("removes cdn-cgi rocket-loader script", () => {
    const html = `<head><script src="/cdn-cgi/scripts/abc/rocket-loader.min.js" defer>/* loader */</script></head>`;
    expect(stripCloudflareArtifacts(html)).toBe("<head></head>");
  });

  test("removes script tagged rocket-loader inline", () => {
    const html = `<head><script data-rocket-loader>rl()</script></head>`;
    expect(stripCloudflareArtifacts(html)).toBe("<head></head>");
  });

  test("removes cloudflareinsights beacon", () => {
    const html = `<head><script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script></head>`;
    expect(stripCloudflareArtifacts(html)).toBe("<head></head>");
  });

  test("removes builds/meta link tags", () => {
    const html = `<head><link rel="preload" href="/cdn-cgi/builds/meta/abc.json"></head>`;
    expect(stripCloudflareArtifacts(html)).toBe("<head></head>");
  });

  test("preserves non-CF scripts", () => {
    const html = `<head><script src="/app.js"></script></head>`;
    expect(stripCloudflareArtifacts(html)).toBe(html);
  });

  test("removes multiple CF tags in one pass", () => {
    const html = `<head>
      <script src="/cdn-cgi/x/rocket-loader.min.js"></script>
      <script src="https://static.cloudflareinsights.com/beacon.min.js"></script>
      <script src="/app.js"></script>
    </head>`;
    const out = stripCloudflareArtifacts(html);
    expect(out).toContain("/app.js");
    expect(out).not.toContain("cdn-cgi");
    expect(out).not.toContain("cloudflareinsights");
  });
});

describe("stripCloudflareArtifacts: attribute rewrites", () => {
  test("removes crossorigin attributes", () => {
    const html = `<script src="/a.js" crossorigin="anonymous"></script>`;
    expect(stripCloudflareArtifacts(html)).toBe(`<script src="/a.js"></script>`);
  });

  test("removes integrity attributes", () => {
    const html = `<link rel="stylesheet" integrity="sha384-XYZ==" href="/a.css">`;
    expect(stripCloudflareArtifacts(html)).toBe(`<link rel="stylesheet" href="/a.css">`);
  });

  test("rewrites hashed module type to type=\"module\"", () => {
    const html = `<script type="abc123-module" src="/a.js"></script>`;
    expect(stripCloudflareArtifacts(html)).toBe(`<script type="module" src="/a.js"></script>`);
  });

  test("rewrites uppercase-hex hashed module type", () => {
    const html = `<script type="DEADBEEF-module"></script>`;
    expect(stripCloudflareArtifacts(html)).toBe(`<script type="module"></script>`);
  });

  test("strips hashed text/javascript type attribute", () => {
    const html = `<script type="abc123-text/javascript" src="/a.js"></script>`;
    const out = stripCloudflareArtifacts(html);
    expect(out).not.toContain("abc123-text");
    expect(out).toContain('src="/a.js"');
  });

  test("leaves plain type=\"module\" untouched", () => {
    const html = `<script type="module" src="/a.js"></script>`;
    expect(stripCloudflareArtifacts(html)).toBe(html);
  });
});

describe("stripCloudflareArtifacts: asset origin rewrite", () => {
  test("rewrites absolute asset URLs to relative when assetOrigin given", () => {
    const html = `<link href="https://bagibagi.co/fonts/a.woff"><img src="https://bagibagi.co/logo.png">`;
    const out = stripCloudflareArtifacts(html, "https://bagibagi.co");
    expect(out).toBe(`<link href="/fonts/a.woff"><img src="/logo.png">`);
  });

  test("does not rewrite when assetOrigin omitted", () => {
    const html = `<img src="https://bagibagi.co/a.png">`;
    expect(stripCloudflareArtifacts(html)).toBe(html);
  });

  test("does not rewrite unrelated origins", () => {
    const html = `<img src="https://other.com/a.png">`;
    expect(stripCloudflareArtifacts(html, "https://bagibagi.co")).toBe(html);
  });
});

describe("stripCloudflareArtifacts: real-world payload", () => {
  test("cleans a realistic CF-protected head block", () => {
    const html = `<head>
      <script type="abc123-module" src="https://bagibagi.co/_next/static/chunks/main.js" crossorigin="anonymous" integrity="sha384-zzz"></script>
      <script src="/cdn-cgi/scripts/abc/rocket-loader.min.js"></script>
      <link rel="preload" href="/cdn-cgi/builds/meta/x.json">
      <script src="https://static.cloudflareinsights.com/beacon.min.js"></script>
    </head>`;
    const out = stripCloudflareArtifacts(html, "https://bagibagi.co");

    expect(out).toContain('type="module"');
    expect(out).toContain('src="/_next/static/chunks/main.js"');
    expect(out).not.toContain("crossorigin");
    expect(out).not.toContain("integrity");
    expect(out).not.toContain("cdn-cgi");
    expect(out).not.toContain("rocket-loader");
    expect(out).not.toContain("cloudflareinsights");
    expect(out).not.toContain("builds/meta");
  });
});
