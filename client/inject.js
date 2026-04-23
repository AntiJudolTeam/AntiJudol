import * as saweria from "./wsProtocol/saweria.js";
import * as bagibagi from "./wsProtocol/bagibagi.js";
import * as sociabuzz from "./wsProtocol/sociabuzz.js";
import * as tako from "./wsProtocol/tako.js";

(function () {
  "use strict";

  const config = window.__ANTIJUDOL__ || {};
  const platform = config.platform || "unknown";
  const overlayType = config.overlayType || "";
  const streamKey = config.streamKey || "";
  const backendOrigin = config.backendOrigin || "";
  const backendPathPrefix = config.backendPathPrefix || null;
  const checkEndpoint = config.checkEndpoint || "/check";
  const backendPrefix = config.backendPrefix || "/backend";
  const isDev = config.dev || false;

  function log(...args) {
    if (isDev) console.log("[AntiJudol]", ...args);
  }

  const LOCAL_BACKEND = window.location.origin + backendPrefix + "/" + platform;
  const backendOriginOnly = backendOrigin ? new URL(backendOrigin).origin : "";

  function buildProxyUrl(path) {
    const sep = path.includes("?") ? "&" : "?";
    let u = LOCAL_BACKEND + path + sep + "streamKey=" + encodeURIComponent(streamKey);
    if (overlayType) u += "&overlayType=" + encodeURIComponent(overlayType);
    return u;
  }

  function rewriteFetchUrl(url) {
    if (typeof url !== "string") return url;
    if (backendOrigin && url.startsWith(backendOrigin)) {
      const rewritten = buildProxyUrl(url.slice(backendOriginOnly.length));
      log("REWRITE", url, "->", rewritten);
      return rewritten;
    }
    if (backendPathPrefix && url.startsWith(backendPathPrefix)) {
      const rewritten = buildProxyUrl(url);
      log("REWRITE", url, "->", rewritten);
      return rewritten;
    }
    return url;
  }

  function checkSync(donation) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", checkEndpoint, false);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(
        JSON.stringify({
          platform,
          donator: donation.donator,
          message: donation.message,
          amount: donation.amount,
          currency: donation.currency,
        })
      );
      if (xhr.status === 200) return JSON.parse(xhr.responseText);
    } catch (err) {
      log("CHECK FAILED", err && err.message);
    }
    return { action: "allow" };
  }

  const wsProtocol = { saweria, bagibagi, sociabuzz };

  function filterWsData(rawData) {
    const proto = wsProtocol[platform];
    if (!proto) return rawData;

    const donations = proto.parse(rawData);
    if (!donations || donations.length === 0) return rawData;

    for (const donation of donations) {
      log("DONATION", donation.donator, "-", donation.message);
      const result = checkSync(donation);
      log("CHECK", result.action, donation.donator);
      if (result.action === "block") {
        log("BLOCKED", donation.donator, donation.message);
        return proto.modify(rawData, result);
      }
    }
    return rawData;
  }

  let wsDonationTriggered = false;

  function checkTakoWsSignal(rawData) {
    if (platform !== "tako") return;
    if (tako.detectDonationSignal(rawData)) {
      wsDonationTriggered = true;
      log("WS SIGNAL", "messages (Tako donation trigger)");
    }
  }

  function deliverWsMessage(event, listener, context) {
    checkTakoWsSignal(event.data);
    const modified = filterWsData(event.data);
    if (modified !== event.data) {
      log("WS MODIFIED", "delivering modified data");
      listener.call(
        context,
        new MessageEvent("message", {
          data: modified,
          origin: event.origin,
          lastEventId: event.lastEventId,
          source: event.source,
        })
      );
    } else {
      listener.call(context, event);
    }
  }

  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function (url, protocols) {
    log("WS CONNECT", url);
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    const origAddEventListener = ws.addEventListener.bind(ws);

    ws.addEventListener = function (type, listener, options) {
      if (type === "message" && listener) {
        return origAddEventListener(
          type,
          function (event) {
            deliverWsMessage(event, listener, this);
          },
          options
        );
      }
      return origAddEventListener(type, listener, options);
    };

    let onMessageHandler = null;
    Object.defineProperty(ws, "onmessage", {
      get() {
        return onMessageHandler;
      },
      set(handler) {
        onMessageHandler = handler;
        origAddEventListener("message", function (event) {
          deliverWsMessage(event, handler || (() => {}), ws);
        });
      },
    });

    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
  for (const state of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    Object.defineProperty(window.WebSocket, state, { value: OriginalWebSocket[state] });
  }

  const originalFetch = window.fetch;

  window.fetch = function (...args) {
    const originalUrl = args[0] instanceof Request ? args[0].url : args[0];
    const rewritten = rewriteFetchUrl(typeof originalUrl === "string" ? originalUrl : String(originalUrl));

    if (rewritten !== originalUrl) {
      args[0] = args[0] instanceof Request ? new Request(rewritten, args[0]) : rewritten;
    }

    const fetchPromise = originalFetch.apply(this, args);

    if (platform === "tako" && rewritten !== originalUrl && wsDonationTriggered) {
      wsDonationTriggered = false;
      log("TAKO FETCH", "intercepting donation response");
      return fetchPromise.then((res) =>
        res
          .clone()
          .json()
          .then((data) => {
            const donation = tako.parseFetchBody(data);
            if (!donation) return res;

            log("DONATION", donation.donator, "-", donation.message);
            const result = checkSync(donation);
            log("CHECK", result.action, donation.donator);

            if (result.action === "block") {
              log("BLOCKED", donation.donator, donation.message);
              const modified = tako.modifyFetchBody(data, result);
              return new Response(JSON.stringify(modified), {
                status: res.status,
                statusText: res.statusText,
                headers: res.headers,
              });
            }
            return res;
          })
          .catch(() => res)
      );
    }

    return fetchPromise;
  };

  const OrigXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    const rewritten = rewriteFetchUrl(typeof url === "string" ? url : String(url));
    return OrigXHROpen.call(this, method, rewritten, ...rest);
  };
})();
