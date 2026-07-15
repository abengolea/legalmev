/**
 * PjnAuthAdapter — corre en el service worker (background.js).
 *
 * Coordina la detección de sesión y el auto-login en PJN / SCW.
 * La lógica de DOM vive en content/pjn-session.js.
 *
 * Uso:
 *   const adapter = new LegalMevPjnAuthAdapter();
 *   const status = await adapter.detectSession(tabId);
 *   const result = await adapter.login(tabId, { cuit, password });
 *   const user   = await adapter.verifyAuthenticatedUser(tabId);
 */

(function () {
  'use strict';

  const CONFIG = self.LegalMevPortalsConfig?.PJN;
  if (!CONFIG) throw new Error('[PjnAuth] LegalMevPortalsConfig no está cargado');

  const MSG_TIMEOUT_MS = 10_000;
  const NAV_TIMEOUT_MS = 25_000;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function sendToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout enviando mensaje a tab ${tabId}`)),
        MSG_TIMEOUT_MS
      );
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  function waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Tab ${tabId} no terminó de cargar`)),
        NAV_TIMEOUT_MS
      );

      function checkTab() {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timer);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (tab.status === 'complete') {
            clearTimeout(timer);
            resolve(tab);
          } else {
            setTimeout(checkTab, 400);
          }
        });
      }
      checkTab();
    });
  }

  async function navigateTab(tabId, url) {
    await chrome.tabs.update(tabId, { url });
    await waitForTabLoad(tabId);
    // SCW JSF puede tener renders adicionales; esperar un poco más
    await new Promise(r => setTimeout(r, 800));
  }

  // ─── PjnAuthAdapter ──────────────────────────────────────────────────────

  class PjnAuthAdapter {
    get portal() { return 'PJN'; }

    /**
     * Detecta el estado de sesión en SCW.
     * @param {number} tabId
     * @returns {Promise<'authenticated' | 'login-required' | 'unknown'>}
     */
    async detectSession(tabId) {
      try {
        const response = await sendToTab(tabId, { type: 'PJN_DETECT_SESSION' });
        return response?.status ?? 'unknown';
      } catch {
        try {
          await navigateTab(tabId, CONFIG.urls.afterLogin);
          const response2 = await sendToTab(tabId, { type: 'PJN_DETECT_SESSION' });
          return response2?.status ?? 'unknown';
        } catch {
          return 'unknown';
        }
      }
    }

    /**
     * Inicia sesión en PJN / SCW con las credenciales dadas.
     *
     * Flujo:
     * 1. Navegar a la URL de login de SCW
     * 2. Enviar CUIT y contraseña al content script
     * 3. El content script llena el formulario JSF y espera resultado
     *
     * Nota: SCW puede ser lento al responder (JSF + RichFaces).
     * El timeout del content script es de 20 segundos.
     *
     * @param {number} tabId
     * @param {{ cuit: string, password: string }} credentials
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async login(tabId, credentials) {
      const tab = await chrome.tabs.get(tabId);
      const isLoginPage = CONFIG.patterns.loginRequired.some(p => p.test(tab.url || ''));
      if (!isLoginPage) {
        try {
          await navigateTab(tabId, CONFIG.urls.login);
        } catch (e) {
          return { success: false, error: `No se pudo navegar a SCW: ${e.message}` };
        }
      }

      let result;
      try {
        result = await sendToTab(tabId, {
          type: 'PJN_LOGIN',
          credentials: {
            cuit: credentials.cuit,
            password: credentials.password,
          },
        });
      } catch (e) {
        return { success: false, error: `Error enviando credenciales a PJN: ${e.message}` };
      }

      return result;
    }

    /**
     * Verifica qué CUIT está autenticado en la pestaña.
     * @param {number} tabId
     * @returns {Promise<{ cuit: string } | null>}
     */
    async verifyAuthenticatedUser(tabId) {
      try {
        const response = await sendToTab(tabId, { type: 'PJN_DETECT_SESSION' });
        if (response?.status === 'authenticated') {
          return { cuit: response.cuit || '' };
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  if (typeof window !== 'undefined') window.LegalMevPjnAuthAdapter = PjnAuthAdapter;
  if (typeof self !== 'undefined') self.LegalMevPjnAuthAdapter = PjnAuthAdapter;
})();
