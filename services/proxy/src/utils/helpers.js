import path from "node:path";
import { COOKIE_PLATFORM, GLOBAL_CONFIG_KEY, CHECK_ENDPOINT, BACKEND_PREFIX } from "../constants.js";
import { IS_DEV } from "../config.js";
import { PUBLIC_DIR } from "./paths.js";

const INJECT_SCRIPT = await Bun.file(path.join(PUBLIC_DIR, "inject.js")).text();

const COOKIE_RE = new RegExp(`${COOKIE_PLATFORM}=(\\w+)`);

export function getPlatformFromCookie(req) {
  const match = (req.headers.cookie || "").match(COOKIE_RE);
  return match ? match[1] : null;
}

export function getPlatformFromReferer(req) {
  try {
    const referer = req.headers.referer || "";
    const refererUrl = new URL(referer, `http://${req.headers.host}`);
    return refererUrl.searchParams.get("platform") || null;
  } catch {
    return null;
  }
}

export function injectScripts(html, platform, platformName, overlayType, streamKey, clientPath) {
  const configBlock = `
    document.cookie = '${COOKIE_PLATFORM}=${platformName}; path=/';
    history.replaceState(null, '', ${JSON.stringify(clientPath)});
    window.${GLOBAL_CONFIG_KEY} = {
      platform: ${JSON.stringify(platformName)},
      overlayType: ${JSON.stringify(overlayType || "")},
      streamKey: ${JSON.stringify(streamKey)},
      backendOrigin: ${JSON.stringify(platform.backendOrigin)},
      backendPathPrefix: ${JSON.stringify(platform.backendPathPrefix || null)},
      checkEndpoint: ${JSON.stringify(CHECK_ENDPOINT)},
      backendPrefix: ${JSON.stringify(BACKEND_PREFIX)},
      dev: ${JSON.stringify(IS_DEV)}
    };`;

  if (platform.useImpersonate) {
    const block = `<script data-cfasync="false">${configBlock}\n${INJECT_SCRIPT}</script>`;
    return html.replace(/<head[^>]*>/, "$&" + block);
  }
  const block = `
      <script>${configBlock}</script>
      <script src="/inject.js"></script>`;
  return html.replace("</head>", block + "</head>");
}
