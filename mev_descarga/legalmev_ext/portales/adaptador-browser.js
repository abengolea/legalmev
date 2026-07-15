/**
 * Adaptador de portal vía pestaña del usuario (SPEC-02).
 * Solo pide metadatos de movimientos al content script; no descarga el expediente.
 */
(function (root) {
  'use strict';

  const Err = () => root.LegalMevSegErrores;
  const LIST_TIMEOUT_MS = 45_000;
  const LOAD_TIMEOUT_MS = 30_000;

  function portalFromUrl(url) {
    const u = String(url || '').toLowerCase();
    if (/mev\.scba\.gov\.ar/i.test(u)) return 'MEV';
    if (/pjn\.gov\.ar/i.test(u)) return 'PJN';
    if (/m[vi]\.mpba\.gov\.ar/i.test(u)) return 'MPBA';
    if (/justiciasalta\.gov\.ar/i.test(u)) return 'SALTA';
    if (/jusentrerios\.gov\.ar/i.test(u)) return 'ENTRERIOS';
    if (/justucuman\.gov\.ar/i.test(u)) return 'TUCUMAN';
    return '';
  }

  async function findTabForUrl(url) {
    if (!url) return null;
    try {
      const tabs = await chrome.tabs.query({});
      const exact = tabs.find((t) => t.url && t.url.split('#')[0] === url.split('#')[0]);
      if (exact) return exact;
      return tabs.find((t) => t.url && url && t.url.includes(new URL(url).pathname.slice(0, 40))) || null;
    } catch {
      return null;
    }
  }

  function waitTabComplete(tabId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      function check() {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(Err().SegError(Err().CODES.RED, chrome.runtime.lastError.message));
            return;
          }
          if (tab.status === 'complete') {
            resolve(tab);
            return;
          }
          if (Date.now() - t0 > timeoutMs) {
            reject(Err().SegError(Err().CODES.TIMEOUT));
            return;
          }
          setTimeout(check, 300);
        });
      }
      check();
    });
  }

  async function ensureTab(ref) {
    const url = ref.urlConsulta || ref.url;
    if (!url) throw Err().SegError(Err().CODES.FALTA_URL);
    let tab = await findTabForUrl(url);
    if (!tab) {
      tab = await chrome.tabs.create({ url, active: false });
      await waitTabComplete(tab.id, LOAD_TIMEOUT_MS);
      await new Promise((r) => setTimeout(r, 800));
    }
    return tab.id;
  }

  function askMovements(tabId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Err().SegError(Err().CODES.TIMEOUT)), LIST_TIMEOUT_MS);
      chrome.tabs.sendMessage(tabId, { type: 'MONITOR_LIST_MOVEMENTS' }, (resp) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(Err().SegError(Err().CODES.PARSEO, chrome.runtime.lastError.message));
          return;
        }
        if (!resp?.ok) {
          reject(Err().SegError(Err().CODES.PARSEO, resp?.error || 'Sin respuesta del portal'));
          return;
        }
        resolve(resp.movements || []);
      });
    });
  }

  async function obtenerMovimientos(ref, options) {
    const tabId = options?.tabId || (await ensureTab(ref));
    return askMovements(tabId);
  }

  root.LegalMevSegAdaptadorBrowser = { obtenerMovimientos, portalFromUrl, ensureTab };
})(typeof self !== 'undefined' ? self : window);
