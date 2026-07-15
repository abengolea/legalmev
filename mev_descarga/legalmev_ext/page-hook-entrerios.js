/**
 * MAIN world — Mesa Virtual Entre Ríos.
 * Captura el Bearer de Keycloak desde fetch/XHR de la página (el content script aislado no lo ve).
 * Corre en document_start antes de que Apollo cargue GraphQL.
 */
(function () {
  'use strict';
  if (globalThis.__LEGALMEV_ER_MAIN_HOOK__) return;
  globalThis.__LEGALMEV_ER_MAIN_HOOK__ = true;

  const STORAGE_KEY = '__legalmev_er_bearer';

  function saveToken(token) {
    if (!token || typeof token !== 'string') return;
    const t = token.trim();
    if (t.length < 40) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, t);
    } catch (_) {}
    try {
      globalThis.__LEGALMEV_ER_TOKEN__ = t;
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

  const origFetch = globalThis.fetch;
  if (typeof origFetch === 'function') {
    globalThis.fetch = function (...args) {
      try {
        const input = args[0];
        const init = args[1] || {};
        peekHeaders(init.headers);
        if (input && typeof input.headers?.get === 'function') peekHeaders(input.headers);
      } catch (_) {}
      return origFetch.apply(this, args);
    };
  }

  const XHR = globalThis.XMLHttpRequest;
  if (XHR?.prototype?.setRequestHeader) {
    const origSet = XHR.prototype.setRequestHeader;
    XHR.prototype.setRequestHeader = function (name, value) {
      if (/^authorization$/i.test(String(name || ''))) fromAuthHeader(value);
      return origSet.apply(this, arguments);
    };
  }

  function tryKeycloak() {
    try {
      const candidates = [
        globalThis.keycloak,
        globalThis._keycloak,
        globalThis.__keycloak,
        globalThis.kc
      ];
      for (const kc of candidates) {
        if (kc?.token) saveToken(kc.token);
      }
    } catch (_) {}
  }

  tryKeycloak();
  setInterval(tryKeycloak, 1500);
})();
