/**
 * MAIN world — Portal SAE Tucumán (consultaexpedientes.justucuman.gov.ar).
 * Captura respuestas de /proceedings/history y el Bearer saeToken
 * antes de que el content script aislado los necesite.
 */
(function () {
  'use strict';
  if (globalThis.__LEGALMEV_TUCUMAN_MAIN_HOOK__) return;
  globalThis.__LEGALMEV_TUCUMAN_MAIN_HOOK__ = true;

  const STATE_KEY = '__legalmev_tucuman_history';
  const TOKEN_KEY = '__legalmev_tucuman_token';

  function saveToken(token) {
    if (!token || typeof token !== 'string') return;
    const t = token.trim();
    if (t.length < 8) return;
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch (_) {}
    try {
      globalThis.__LEGALMEV_TUCUMAN_TOKEN__ = t;
    } catch (_) {}
  }

  function fromAuthHeader(value) {
    if (!value || typeof value !== 'string') return;
    const m = value.match(/Bearer\s+(.+)/i);
    if (m?.[1]) saveToken(m[1]);
  }

  function peekHeaders(headers) {
    if (!headers) return;
    try {
      if (typeof headers.get === 'function') {
        fromAuthHeader(headers.get('Authorization') || headers.get('authorization'));
        return;
      }
      if (Array.isArray(headers)) {
        for (const pair of headers) {
          if (pair && /^authorization$/i.test(String(pair[0] || ''))) fromAuthHeader(pair[1]);
        }
        return;
      }
      fromAuthHeader(headers.Authorization || headers.authorization);
    } catch (_) {}
  }

  function readCookieToken() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)saeToken=([^;]+)/);
      if (m?.[1]) saveToken(decodeURIComponent(m[1]));
    } catch (_) {}
  }

  function unwrapEnvelope(json) {
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.success ? json.data : null;
    }
    return json;
  }

  function saveHistoryPayload(data, urlHint) {
    if (!data || typeof data !== 'object') return;
    const proceeding = data.proceeding || null;
    const stories = Array.isArray(data.stories) ? data.stories : null;
    if (!proceeding && !stories) return;
    const payload = {
      proceeding: proceeding || null,
      stories: stories || [],
      capturedAt: Date.now(),
      url: urlHint || location.href
    };
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(payload));
    } catch (_) {}
    try {
      globalThis.__LEGALMEV_TUCUMAN_HISTORY__ = payload;
    } catch (_) {}
  }

  function maybeCaptureUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // history list, texto del movimiento, y descarga de adjuntos
    return /conexpbe\.justucuman\.gov\.ar\/api(?:\/user)?\/proceedings\/history(?:\/text(?:\/download)?|\/file)?(?:\?|$|\/)/i.test(
      url
    );
  }

  function saveFileUrl(histid, filename, fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return;
    try {
      const map = JSON.parse(sessionStorage.getItem(STATE_KEY + '_files') || '{}');
      if (histid != null) map[`${histid}::${filename}`] = fileUrl;
      if (filename) map[filename] = fileUrl;
      sessionStorage.setItem(STATE_KEY + '_files', JSON.stringify(map));
    } catch (_) {}
  }

  function handleJsonBody(url, body, requestBody) {
    if (!url || body == null) return;
    const isList = /\/proceedings\/history(?:\?|$)/i.test(url) && !/\/history\/(?:text|file)/i.test(url);
    const isText = /\/proceedings\/history\/text(?:\?|$)/i.test(url) && !/\/download/i.test(url);
    const isFile = /\/proceedings\/history\/file/i.test(url);
    if (!isList && !isText && !isFile) return;
    try {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      const data = unwrapEnvelope(json);
      if (isFile) {
        const fileUrl =
          typeof data === 'string'
            ? data
            : data && typeof data === 'object'
              ? data.url || data.data || null
              : null;
        let filename = '';
        let histid = null;
        try {
          const req =
            typeof requestBody === 'string'
              ? JSON.parse(requestBody)
              : requestBody && typeof requestBody === 'object'
                ? requestBody
                : null;
          if (req?.file) {
            try {
              filename = atob(req.file);
            } catch (_) {
              filename = '';
            }
          }
          if (req?.history != null) histid = req.history;
        } catch (_) {}
        if (fileUrl) saveFileUrl(histid, filename || 'adjunto', fileUrl);
        return;
      }
      if (!data) return;
      if (isList) saveHistoryPayload(data, url);
      if (isText && data) {
        try {
          const hist = data.history || data;
          const id = hist?.histid;
          if (id != null) {
            const mapRaw = sessionStorage.getItem(STATE_KEY + '_texts') || '{}';
            const map = JSON.parse(mapRaw);
            map[String(id)] = data;
            sessionStorage.setItem(STATE_KEY + '_texts', JSON.stringify(map));
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  const origFetch = globalThis.fetch;
  if (typeof origFetch === 'function') {
    globalThis.fetch = function (...args) {
      try {
        const input = args[0];
        const init = args[1] || {};
        peekHeaders(init.headers);
        if (input && typeof input.headers?.get === 'function') peekHeaders(input.headers);
      } catch (_) {}
      const p = origFetch.apply(this, args);
      try {
        const input = args[0];
        const init = args[1] || {};
        const url = typeof input === 'string' ? input : input?.url;
        const reqBody = init.body || null;
        if (maybeCaptureUrl(url)) {
          p.then(async (resp) => {
            try {
              const clone = resp.clone();
              const text = await clone.text();
              handleJsonBody(url, text, reqBody);
            } catch (_) {}
          }).catch(() => {});
        }
      } catch (_) {}
      return p;
    };
  }

  const XHR = globalThis.XMLHttpRequest;
  if (XHR?.prototype?.open) {
    const origOpen = XHR.prototype.open;
    const origSend = XHR.prototype.send;
    const origSet = XHR.prototype.setRequestHeader;

    XHR.prototype.open = function (method, url, ...rest) {
      this.__lm_tuc_url = url;
      return origOpen.call(this, method, url, ...rest);
    };

    if (origSet) {
      XHR.prototype.setRequestHeader = function (name, value) {
        if (/^authorization$/i.test(String(name || ''))) fromAuthHeader(value);
        return origSet.apply(this, arguments);
      };
    }

    XHR.prototype.send = function (...args) {
      this.__lm_tuc_body = args[0] || null;
      this.addEventListener('load', function () {
        try {
          handleJsonBody(this.__lm_tuc_url || '', this.responseText, this.__lm_tuc_body);
        } catch (_) {}
      });
      return origSend.apply(this, args);
    };
  }

  readCookieToken();
  setInterval(readCookieToken, 5000);
})();
