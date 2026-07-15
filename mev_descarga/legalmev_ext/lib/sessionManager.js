/**
 * Session Manager para la extensión Chrome LegalMev
 *
 * Reglas:
 * - NUNCA confiar en caché como fuente de verdad
 * - SIEMPRE validar sesión contra el backend
 * - Si userId cambia → limpiar sesión (NO las causas seguidas)
 * - Si 401 o authenticated=false → limpiar sesión y pedir login
 * - Las causas monitoreadas viven en storage local y NO se borran al re-loguear
 */

const SESSION_TTL_MS = 5000;
const STORAGE_KEY_SESSION = 'legalmev_session';
const STORAGE_KEY_FETCHED_AT = 'legalmev_session_fetched_at';

/** Claves de auth/sesión que sí se limpian al cerrar sesión */
const AUTH_KEYS = [
  'authToken',
  'apiBase',
  'userNombre',
  STORAGE_KEY_SESSION,
  STORAGE_KEY_FETCHED_AT,
  'legalmev_export_job',
];

/**
 * Datos locales que deben sobrevivir a login/logout:
 * monitoreo de causas, vault, preferencias, onboarding, deviceId.
 */
const PERSIST_PREFIXES = [
  'lm_seg_',
  'lm_mon_',
  'legalmev_boveda',
  'legalmev_vault',
  'legalmev_onboarding',
  'legalmev_taskqueue',
];
const PERSIST_KEYS = new Set([
  'closeTabAfterConnect',
  'deviceId',
  'legalmev_onboarding_done',
  'legalmev_boveda_v1',
  'legalmev_vault_v1',
  'legalmev_vault_session',
]);

let _config = null;

function initSessionManager(config) {
  _config = config;
}

function getConfig() {
  if (!_config) throw new Error('SessionManager no inicializado. Llamar initSessionManager() primero.');
  return _config;
}

function shouldPersistKey(key) {
  if (PERSIST_KEYS.has(key)) return true;
  return PERSIST_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Limpia solo sesión/auth. Nunca borra causas seguidas ni settings de monitoreo.
 * (Antes usaba chrome.storage.local.clear() y perdía todo el gestor de causas.)
 */
async function clearExtensionSession() {
  try {
    const all = await chrome.storage.local.get(null);
    const toRemove = Object.keys(all || {}).filter((k) => !shouldPersistKey(k));
    // Asegurar que las claves de auth se quiten aunque no estuvieran en el dump
    for (const k of AUTH_KEYS) {
      if (!toRemove.includes(k) && !shouldPersistKey(k)) toRemove.push(k);
    }
    if (toRemove.length) await chrome.storage.local.remove(toRemove);
    console.log('[LegalMev Session] Sesión limpiada (causas preservadas)');
  } catch (err) {
    console.error('[LegalMev Session] Error al limpiar sesión:', err);
  }
}

function invalidateSessionCache() {
  chrome.storage.local.remove([STORAGE_KEY_SESSION, STORAGE_KEY_FETCHED_AT], () => {
    console.log('[LegalMev Session] Caché de sesión invalidada');
  });
}

async function getFreshSession(forceRefresh = false) {
  const config = getConfig();
  const emptySession = {
    authenticated: false,
    userId: '',
    email: '',
    plan: 'free',
    remainingQueries: null
  };

  let storedSession = null;
  let storedFetchedAt = null;

  try {
    const result = await chrome.storage.local.get([STORAGE_KEY_SESSION, STORAGE_KEY_FETCHED_AT]);
    storedSession = result[STORAGE_KEY_SESSION] ?? null;
    storedFetchedAt = result[STORAGE_KEY_FETCHED_AT] ?? null;
  } catch (_) {}

  const token = await config.getAuthToken();
  if (!token) {
    console.log('[LegalMev Session] No hay token, sesión no autenticada');
    await clearExtensionSession();
    return emptySession;
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    storedSession?.authenticated &&
    storedFetchedAt &&
    now - storedFetchedAt < SESSION_TTL_MS
  ) {
    console.log('[LegalMev Session] Usando sesión en caché (TTL válido)');
    return storedSession;
  }

  try {
    const { deviceId } = await chrome.storage.local.get('deviceId');
    const headers = { Authorization: `Bearer ${token}` };
    if (deviceId) headers['X-Device-Id'] = deviceId;

    let data = null;
    const sessionRes = await fetch(`${config.apiBaseUrl}/api/extension/session`, {
      method: 'GET',
      headers
    });

    if (sessionRes.ok) {
      try {
        data = await sessionRes.json();
      } catch (_) {
        data = null;
      }
    }

    if (!data || !data.authenticated) {
      const meRes = await fetch(`${config.apiBaseUrl}/api/extension/me`, {
        method: 'GET',
        headers
      });
      if (meRes.ok) {
        try {
          const meData = await meRes.json();
          if (meData?.ok && meData?.user) {
            data = {
              authenticated: true,
              userId: meData.user.id || '',
              email: meData.user.email || '',
              plan: meData.user.plan || 'free',
              remainingQueries: null
            };
          }
        } catch (_) {}
      }
    }

    if (!data || !data.authenticated) {
      if (sessionRes.status === 401 || sessionRes.status === 403 || (data && !data.authenticated)) {
        console.log('[LegalMev Session] Sesión inválida, expirada o dispositivo no autorizado');
        await clearExtensionSession();
      }
      return { ...emptySession, error: data?.error };
    }

    if (storedSession?.authenticated && storedSession.userId && storedSession.userId !== data.userId) {
      console.log('[LegalMev Session] Cambio de usuario detectado:', storedSession.userId, '->', data.userId);
      await clearExtensionSession();
      await chrome.storage.local.set({ authToken: token, apiBase: config.apiBaseUrl });
    }

    try {
      await chrome.storage.local.set({
        [STORAGE_KEY_SESSION]: data,
        [STORAGE_KEY_FETCHED_AT]: now
      });
    } catch (_) {}

    console.log('[LegalMev Session] Sesión obtenida:', data.userId, data.plan, data.remainingQueries);
    return data;
  } catch (err) {
    console.error('[LegalMev Session] Error al obtener sesión:', err);
    if (storedSession?.authenticated && storedFetchedAt && now - storedFetchedAt < 60000) {
      return storedSession;
    }
    return emptySession;
  }
}

const SessionManager = {
  initSessionManager,
  getFreshSession,
  clearExtensionSession,
  invalidateSessionCache
};

if (typeof window !== 'undefined') {
  window.LegalMevSessionManager = SessionManager;
}
if (typeof self !== 'undefined') {
  self.LegalMevSessionManager = SessionManager;
}
