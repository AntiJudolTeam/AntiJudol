import { USER_AGENT, BROWSER_HEADERS } from "./constants.js";

// Fields: name, streamKeyParam, overlays, overlayUrl(), assetOrigin,
// backendOrigin, backendPathPrefix, backendHeaders({streamKey,overlayType}),
// assetHeaders() (defaulted), useImpersonate?, forwardHeaders?.
const DEFAULT_ASSET_HEADERS = () => ({ "user-agent": USER_AGENT });

const platforms = {
  saweria: {
    name: "Saweria",
    streamKeyParam: "streamKey",
    overlays: ["alert", "mediashare"],
    overlayUrl: ({ streamKey, overlayType = "alert" }) =>
      `https://saweria.co/widgets/${overlayType}?streamKey=${streamKey}`,
    assetOrigin: "https://saweria.co",
    backendOrigin: "https://backend.saweria.co",
    backendPathPrefix: null,
    backendHeaders: ({ streamKey }) => ({
      accept: "*/*",
      origin: "https://saweria.co",
      referer: "https://saweria.co/",
      "stream-key": streamKey,
      "user-agent": USER_AGENT,
    }),
  },
  tako: {
    name: "Tako",
    streamKeyParam: "overlay_key",
    overlays: ["alert", "mediashare"],
    forwardHeaders: ["x-queued-gift-ids", "x-played-gift-ids", "authorization"],
    overlayUrl: ({ streamKey, overlayType = "alert" }) =>
      `https://tako.id/overlay/${overlayType}?overlay_key=${streamKey}`,
    assetOrigin: "https://tako.id",
    backendOrigin: "https://tako.id/api",
    backendPathPrefix: "/api",
    backendHeaders: ({ streamKey, overlayType = "alert" }) => ({
      ...BROWSER_HEADERS,
      accept: "*/*",
      "content-type": "application/json",
      referer: `https://tako.id/overlay/${overlayType}?overlay_key=${streamKey}`,
      "x-overlay-key": streamKey,
      "x-path": `/overlay/${overlayType}`,
      "x-queued-gift-ids": "",
    }),
  },
  bagibagi: {
    name: "BagiBagi",
    useImpersonate: true,
    streamKeyParam: "streamKey",
    overlays: ["alertbox"],
    overlayUrl: ({ streamKey }) => `https://bagibagi.co/alertbox/${streamKey}`,
    assetOrigin: "https://bagibagi.co",
    backendOrigin: "https://bagibagi.co/api",
    backendPathPrefix: "/api",
    backendHeaders: ({ streamKey }) => ({
      ...BROWSER_HEADERS,
      accept: "application/json, text/plain, */*",
      referer: `https://bagibagi.co/alertbox/${streamKey}`,
    }),
  },
  sociabuzz: {
    name: "Sociabuzz",
    streamKeyParam: "streamKey",
    overlays: ["alert", "mediashare"],
    overlayUrl: ({ streamKey, overlayType = "alert", extraParams = "" }) => {
      const paths = {
        alert: `/pro/tribe/alert1/v3/${streamKey}`,
        mediashare: `/pro/tribe/mediashare/v2/${streamKey}`,
      };
      const base = `https://sociabuzz.com${paths[overlayType] || paths.alert}`;
      return extraParams ? `${base}?${extraParams}` : base;
    },
    assetOrigin: "https://sociabuzz.com",
    backendOrigin: "https://sociabuzz.com/pro",
    backendPathPrefix: "/pro",
    backendHeaders: ({ streamKey }) => ({
      ...BROWSER_HEADERS,
      accept: "*/*",
      referer: `https://sociabuzz.com/pro/tribe/alert1/v3/${streamKey}`,
      "x-requested-with": "XMLHttpRequest",
    }),
  },
};

for (const p of Object.values(platforms)) {
  p.assetHeaders ??= DEFAULT_ASSET_HEADERS;
}

export function getPlatform(name) {
  const platform = platforms[name];
  if (!platform) {
    const available = Object.keys(platforms).join(", ");
    throw new Error(`Unknown platform "${name}". Available: ${available}`);
  }
  return platform;
}

export { platforms };
