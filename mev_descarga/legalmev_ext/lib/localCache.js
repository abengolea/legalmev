/**
 * LocalCache — Caché en chrome.storage.session para evitar fetches duplicados.
 * TTL por defecto 10 minutos. Se limpia al cerrar el browser.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'legalmev_fetch_cache';
  const DEFAULT_TTL = 600;

  async function _getAll() {
    if (!chrome?.storage?.session) return {};
    try {
      const result = await chrome.storage.session.get(STORAGE_KEY);
      return result[STORAGE_KEY] || {};
    } catch (_) {
      return {};
    }
  }

  async function _setAll(data) {
    if (!chrome?.storage?.session) return;
    try {
      await chrome.storage.session.set({ [STORAGE_KEY]: data });
    } catch (_) {}
  }

  function _normalizeUrl(url) {
    try {
      const u = new URL(url, typeof location !== 'undefined' ? location.href : 'https://example.com');
      return u.href;
    } catch (_) {
      return String(url);
    }
  }

  async function get(url) {
    const key = _normalizeUrl(url);
    const data = await _getAll();
    const entry = data[key];
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      delete data[key];
      await _setAll(data);
      return null;
    }
    return entry.content;
  }

  async function set(url, content, opts = {}) {
    const ttl = opts.ttl ?? DEFAULT_TTL;
    const key = _normalizeUrl(url);
    const data = await _getAll();
    data[key] = {
      content,
      expiresAt: Date.now() + ttl * 1000
    };
    await _setAll(data);
  }

  async function has(url) {
    const val = await get(url);
    return val !== null;
  }

  async function remove(url) {
    const key = _normalizeUrl(url);
    const data = await _getAll();
    delete data[key];
    await _setAll(data);
  }

  async function clear() {
    await _setAll({});
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevLocalCache = {
      get,
      set,
      has,
      remove,
      clear,
      DEFAULT_TTL
    };
  }
})();
