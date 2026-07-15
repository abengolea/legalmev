/**
 * MevAuthAdapter — corre en el service worker (background.js).
 *
 * Coordina la detección de sesión y el auto-login en MEV SCBA.
 * La lógica de DOM vive en content/mev-session.js; este módulo
 * orquesta la comunicación con ese content script.
 *
 * Uso:
 *   const adapter = new LegalMevMevAuthAdapter();
 *   const status = await adapter.detectSession(tabId);   // 'authenticated' | 'login-required' | 'unknown'
 *   const result = await adapter.login(tabId, creds);    // { success, error? }
 *   const user   = await adapter.verifyAuthenticatedUser(tabId);  // { username } | null
 */

(function () {
  'use strict';

  const CONFIG = self.LegalMevPortalsConfig?.MEV;
  if (!CONFIG) throw new Error('[MevAuth] LegalMevPortalsConfig no está cargado');

  const MSG_TIMEOUT_MS = 10_000;
  const NAV_TIMEOUT_MS = 20_000;

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

  /**
   * Espera a que una pestaña termine de cargar (status === 'complete').
   */
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
            setTimeout(checkTab, 300);
          }
        });
      }
      checkTab();
    });
  }

  /**
   * Navega una pestaña a una URL y espera que cargue.
   */
  async function navigateTab(tabId, url) {
    await chrome.tabs.update(tabId, { url });
    await waitForTabLoad(tabId);
    // Pequeña pausa para que el content script termine de inyectarse
    await new Promise(r => setTimeout(r, 500));
  }

  // ─── MevAuthAdapter ──────────────────────────────────────────────────────

  class MevAuthAdapter {
    get portal() { return 'MEV'; }

    /**
     * Detecta si hay sesión activa en la pestaña dada.
     * @param {number} tabId
     * @returns {Promise<'authenticated' | 'login-required' | 'unknown'>}
     */
    async detectSession(tabId) {
      try {
        const response = await sendToTab(tabId, { type: 'MEV_DETECT_SESSION' });
        return response?.status ?? 'unknown';
      } catch {
        // Si el content script no responde, intentar navegar a MEV y re-verificar
        try {
          await navigateTab(tabId, CONFIG.urls.base + '/');
          const response2 = await sendToTab(tabId, { type: 'MEV_DETECT_SESSION' });
          return response2?.status ?? 'unknown';
        } catch {
          return 'unknown';
        }
      }
    }

    /**
     * Intenta iniciar sesión en MEV con las credenciales dadas.
     *
     * Flujo:
     * 1. Navegar a la URL de login
     * 2. Verificar que el form de login sea visible
     * 3. Enviar credenciales al content script
     * 4. Si MEV pide selección de departamento, seleccionar el guardado
     *
     * @param {number} tabId
     * @param {{ username: string, password: string, departamento?: string }} credentials
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async login(tabId, credentials) {
      // Asegurarse de estar en la página de login de MEV
      const tab = await chrome.tabs.get(tabId);
      const isMevLogin = CONFIG.patterns.loginRequired.some(p => p.test(tab.url || ''));
      if (!isMevLogin) {
        try {
          await navigateTab(tabId, CONFIG.urls.login);
        } catch (e) {
          return { success: false, error: `No se pudo navegar a MEV: ${e.message}` };
        }
      }

      // Enviar credenciales al content script
      let result;
      try {
        result = await sendToTab(tabId, {
          type: 'MEV_LOGIN',
          credentials: {
            username: credentials.username,
            password: credentials.password,
          },
        });
      } catch (e) {
        return { success: false, error: `Error enviando credenciales a MEV: ${e.message}` };
      }

      // MEV puede pedir selección de departamento tras el login
      if (!result.success && result.error === 'dept-selection-required' && result.requiresDept) {
        try {
          result = await sendToTab(tabId, {
            type: 'MEV_SELECT_DEPTO',
            departamento: credentials.departamento || '',
          });
        } catch (e) {
          return { success: false, error: `Error al seleccionar departamento: ${e.message}` };
        }
      }

      return result;
    }

    /**
     * Verifica quién está autenticado en la pestaña dada.
     * @param {number} tabId
     * @returns {Promise<{ username: string } | null>}
     */
    async verifyAuthenticatedUser(tabId) {
      try {
        const response = await sendToTab(tabId, { type: 'MEV_DETECT_SESSION' });
        if (response?.status === 'authenticated' && response.username) {
          return { username: response.username };
        }
        if (response?.status === 'authenticated') {
          return { username: '' };
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  if (typeof window !== 'undefined') window.LegalMevMevAuthAdapter = MevAuthAdapter;
  if (typeof self !== 'undefined') self.LegalMevMevAuthAdapter = MevAuthAdapter;
})();
