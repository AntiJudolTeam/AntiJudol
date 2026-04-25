(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: (newValue) => all[name] = () => newValue
      });
  };

  // client/wsProtocol/saweria.js
  var exports_saweria = {};
  __export(exports_saweria, {
    parse: () => parse,
    modify: () => modify
  });
  function parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (data.type !== "donation" || !Array.isArray(data.data))
        return null;
      return data.data.map((x) => ({
        donator: x.donator || "",
        message: x.message || "",
        amount: x.amount || 0,
        currency: x.currency || ""
      }));
    } catch {
      return null;
    }
  }
  function modify(raw, replacement) {
    try {
      const data = JSON.parse(raw);
      for (const x of data.data) {
        if (replacement.replaceDonator)
          x.donator = replacement.replaceDonator;
        if (replacement.replaceMessage)
          x.message = replacement.replaceMessage;
        x.tts = null;
      }
      return JSON.stringify(data);
    } catch {
      return raw;
    }
  }

  // client/wsProtocol/bagibagi.js
  var exports_bagibagi = {};
  __export(exports_bagibagi, {
    parse: () => parse2,
    modify: () => modify2
  });
  function parse2(raw) {
    try {
      const data = JSON.parse(raw.replace(/\x1e/g, ""));
      if (data.target !== "Donation" || !Array.isArray(data.arguments))
        return null;
      return data.arguments.map((x) => ({
        donator: x.preferedName || x.username || "",
        message: x.message || "",
        amount: x.amount || 0,
        currency: "IDR"
      }));
    } catch {
      return null;
    }
  }
  function modify2(raw, replacement) {
    try {
      const data = JSON.parse(raw.replace(/\x1e/g, ""));
      for (const x of data.arguments) {
        if (replacement.replaceDonator) {
          x.preferedName = replacement.replaceDonator;
          x.username = replacement.replaceDonator;
        }
        if (replacement.replaceMessage)
          x.message = replacement.replaceMessage;
        x.audioData = null;
      }
      return JSON.stringify(data) + "\x1E";
    } catch {
      return raw;
    }
  }

  // client/wsProtocol/sociabuzz.js
  var exports_sociabuzz = {};
  __export(exports_sociabuzz, {
    parse: () => parse3,
    modify: () => modify3
  });
  function parse3(raw) {
    try {
      const data = JSON.parse(raw);
      if (data.action !== 15 || !Array.isArray(data.messages))
        return null;
      return data.messages.map((m) => {
        const x = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
        return {
          donator: x.fullname || "",
          message: x.note || "",
          amount: parseInt(x.amount, 10) || 0,
          currency: x.currency || "IDR"
        };
      });
    } catch {
      return null;
    }
  }
  function modify3(raw, replacement) {
    try {
      const data = JSON.parse(raw);
      for (const m of data.messages) {
        const x = typeof m.data === "string" ? JSON.parse(m.data) : m.data;
        if (replacement.replaceDonator)
          x.fullname = replacement.replaceDonator;
        if (replacement.replaceMessage)
          x.note = replacement.replaceMessage;
        delete x.tts;
        delete x.voice_note;
        m.data = JSON.stringify(x);
      }
      return JSON.stringify(data);
    } catch {
      return raw;
    }
  }

  // client/wsProtocol/tako.js
  function detectDonationSignal(raw) {
    try {
      const text = typeof raw === "string" ? raw.replace(/\x1e/g, "") : raw;
      const data = JSON.parse(text);
      return data.event === "messages";
    } catch {
      return false;
    }
  }
  function parseFetchBody(data) {
    const donationData = data && data.result;
    if (!donationData || !donationData.sender || !donationData.message)
      return null;
    return {
      donator: donationData.sender.name || "",
      message: donationData.message || "",
      amount: donationData.amount || 0,
      currency: donationData.currency || ""
    };
  }
  function modifyFetchBody(data, replacement) {
    if (replacement.replaceDonator)
      data.result.sender.name = replacement.replaceDonator;
    if (replacement.replaceMessage)
      data.result.message = replacement.replaceMessage;
    return data;
  }

  // client/inject.js
  (function() {
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
      if (isDev)
        console.log("[AntiJudol]", ...args);
    }
    const LOCAL_BACKEND = window.location.origin + backendPrefix + "/" + platform;
    const backendOriginOnly = backendOrigin ? new URL(backendOrigin).origin : "";
    function buildProxyUrl(path) {
      const sep = path.includes("?") ? "&" : "?";
      let u = LOCAL_BACKEND + path + sep + "streamKey=" + encodeURIComponent(streamKey);
      if (overlayType)
        u += "&overlayType=" + encodeURIComponent(overlayType);
      return u;
    }
    function rewriteFetchUrl(url) {
      if (typeof url !== "string")
        return url;
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
        const xhr = new XMLHttpRequest;
        xhr.open("POST", checkEndpoint, false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({
          platform,
          donator: donation.donator,
          message: donation.message,
          amount: donation.amount,
          currency: donation.currency
        }));
        if (xhr.status === 200)
          return JSON.parse(xhr.responseText);
      } catch (err) {
        log("CHECK FAILED", err && err.message);
      }
      return { action: "allow" };
    }
    const wsProtocol = { saweria: exports_saweria, bagibagi: exports_bagibagi, sociabuzz: exports_sociabuzz };
    function filterWsData(rawData) {
      const proto = wsProtocol[platform];
      if (!proto)
        return rawData;
      const donations = proto.parse(rawData);
      if (!donations || donations.length === 0)
        return rawData;
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
      if (platform !== "tako")
        return;
      if (detectDonationSignal(rawData)) {
        wsDonationTriggered = true;
        log("WS SIGNAL", "messages (Tako donation trigger)");
      }
    }
    function deliverWsMessage(event, listener, context) {
      checkTakoWsSignal(event.data);
      const modified = filterWsData(event.data);
      if (modified !== event.data) {
        log("WS MODIFIED", "delivering modified data");
        listener.call(context, new MessageEvent("message", {
          data: modified,
          origin: event.origin,
          lastEventId: event.lastEventId,
          source: event.source
        }));
      } else {
        listener.call(context, event);
      }
    }
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      log("WS CONNECT", url);
      const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
      const origAddEventListener = ws.addEventListener.bind(ws);
      ws.addEventListener = function(type, listener, options) {
        if (type === "message" && listener) {
          return origAddEventListener(type, function(event) {
            deliverWsMessage(event, listener, this);
          }, options);
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
          origAddEventListener("message", function(event) {
            deliverWsMessage(event, handler || (() => {}), ws);
          });
        }
      });
      return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
    for (const state of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
      Object.defineProperty(window.WebSocket, state, { value: OriginalWebSocket[state] });
    }
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const originalUrl = args[0] instanceof Request ? args[0].url : args[0];
      const rewritten = rewriteFetchUrl(typeof originalUrl === "string" ? originalUrl : String(originalUrl));
      if (rewritten !== originalUrl) {
        args[0] = args[0] instanceof Request ? new Request(rewritten, args[0]) : rewritten;
      }
      const fetchPromise = originalFetch.apply(this, args);
      if (platform === "tako" && rewritten !== originalUrl && wsDonationTriggered) {
        wsDonationTriggered = false;
        log("TAKO FETCH", "intercepting donation response");
        return fetchPromise.then((res) => res.clone().json().then((data) => {
          const donation = parseFetchBody(data);
          if (!donation)
            return res;
          log("DONATION", donation.donator, "-", donation.message);
          const result = checkSync(donation);
          log("CHECK", result.action, donation.donator);
          if (result.action === "block") {
            log("BLOCKED", donation.donator, donation.message);
            const modified = modifyFetchBody(data, result);
            return new Response(JSON.stringify(modified), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
          }
          return res;
        }).catch(() => res));
      }
      return fetchPromise;
    };
    const OrigXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      const rewritten = rewriteFetchUrl(typeof url === "string" ? url : String(url));
      return OrigXHROpen.call(this, method, rewritten, ...rest);
    };
  })();
})();
