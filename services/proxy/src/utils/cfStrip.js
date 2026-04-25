const PATTERNS = [
  / crossorigin="[^"]*"/g,
  / integrity="[^"]*"/g,
  /<script[^>]*src="[^"]*cdn-cgi[^"]*"[^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*rocket-loader[^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*cloudflareinsights[^>]*>[\s\S]*?<\/script>/gi,
  /<link[^>]*builds\/meta[^>]*>/gi,
];

export function stripCloudflareArtifacts(html, assetOrigin) {
  let out = html;
  if (assetOrigin) out = out.replaceAll(assetOrigin + "/", "/");
  for (const re of PATTERNS) out = out.replace(re, "");
  out = out.replace(/type="[a-f0-9]+-module"/gi, 'type="module"');
  out = out.replace(/type="[a-f0-9]+-text\/javascript"/gi, "");
  return out;
}
