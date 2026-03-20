/**
 * Session Manager para la extensión Chrome LegalMev
 *
 * IMPORTANTE: Este módulo está diseñado para ejecutarse en el contexto de la extensión
 * (popup, background, content scripts). Usa chrome.storage y fetch.
 *
 * Reglas:
 * - NUNCA confiar en caché como fuente de verdad
 * - SIEMPRE validar sesión contra el backend
 * - Si userId cambia → limpiar todo
 * - Si 401 o authenticated=false → limpiar y pedir login
 */

const SESSION_TTL_MS = 5000; // 5 segundos - evita spam al backend
const STORAGE_KEY_SESSION = 'legalmev_session';
const STORAGE_KEY_FETCHED_AT = 'legalmev_session_fetched_at';

export type ExtensionSession = {
  authenticated: boolean;
  userId: string;
  email: string;
  plan: 'free' | 'pro' | 'unlimited';
  remainingQueries: number | null;
};

export type SessionManagerConfig = {
  apiBaseUrl: string;
  getAuthToken: () => Promise<string | null>;
};

let _config: SessionManagerConfig | null = null;

/**
 * Configura el session manager. Debe llamarse al iniciar la extensión.
 */
export function initSessionManager(config: SessionManagerConfig): void {
  _config = config;
}

function getConfig(): SessionManagerConfig {
  if (!_config) {
    throw new Error('SessionManager no inicializado. Llamar initSessionManager() primero.');
  }
  return _config;
}

/**
 * Limpia TODA la sesión de la extensión.
 * Debe ejecutarse cuando:
 * - El usuario cambia de cuenta
 * - El backend devuelve 401
 * - authenticated === false
 */
export async function clearExtensionSession(): Promise<void> {
  const chrome = (typeof globalThis !== 'undefined' && (globalThis as any).chrome) ?? undefined;
  if (!chrome?.storage) {
    console.warn('[LegalMev Session] chrome.storage no disponible (no estamos en extensión)');
    return;
  }

  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    console.log('[LegalMev Session] Sesión limpiada (local + sync)');
  } catch (err) {
    console.error('[LegalMev Session] Error al limpiar sesión:', err);
  }
}

/**
 * Obtiene la sesión actual validada contra el backend.
 * - Siempre llama al backend (o usa caché TTL de 5s)
 * - Si stored.userId !== fresh.userId → clearExtensionSession() y retorna la nueva sesión
 * - Si 401 o !authenticated → clearExtensionSession() y retorna sesión vacía
 */
export async function getFreshSession(forceRefresh = false): Promise<ExtensionSession> {
  const config = getConfig();
  const chrome = (typeof globalThis !== 'undefined' && (globalThis as any).chrome) ?? undefined;

  const emptySession: ExtensionSession = {
    authenticated: false,
    userId: '',
    email: '',
    plan: 'free',
    remainingQueries: null,
  };

  let storedSession: ExtensionSession | null = null;
  let storedFetchedAt: number | null = null;

  if (chrome?.storage?.local) {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY_SESSION, STORAGE_KEY_FETCHED_AT]);
      storedSession = result[STORAGE_KEY_SESSION] ?? null;
      storedFetchedAt = result[STORAGE_KEY_FETCHED_AT] ?? null;
    } catch {
      // Ignorar errores de lectura
    }
  }

  const token = await config.getAuthToken();
  if (!token) {
    console.log('[LegalMev Session] No hay token, sesión no autenticada');
    await clearExtensionSession();
    return emptySession;
  }

  // TTL: si la última fetch fue hace menos de 5s y no forzamos refresh, reusar
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
    const res = await fetch(`${config.apiBaseUrl}/api/extension/session`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json()) as ExtensionSession;

    if (res.status === 401 || !data.authenticated) {
      console.log('[LegalMev Session] Sesión inválida o expirada (401/!authenticated)');
      await clearExtensionSession();
      return emptySession;
    }

    // Detección de cambio de usuario
    if (storedSession?.authenticated && storedSession.userId && storedSession.userId !== data.userId) {
      console.log(
        '[LegalMev Session] Cambio de usuario detectado:',
        storedSession.userId,
        '->',
        data.userId
      );
      await clearExtensionSession();
    }

    // Guardar nueva sesión
    if (chrome?.storage?.local) {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEY_SESSION]: data,
          [STORAGE_KEY_FETCHED_AT]: now,
        });
      } catch {
        // No crítico
      }
    }

    console.log('[LegalMev Session] Sesión obtenida:', data.userId, data.plan, data.remainingQueries);
    return data;
  } catch (err) {
    console.error('[LegalMev Session] Error al obtener sesión:', err);
    // En caso de error de red, devolver sesión almacenada si existe y es reciente
    if (storedSession?.authenticated && storedFetchedAt && now - storedFetchedAt < 60000) {
      return storedSession;
    }
    return emptySession;
  }
}

/**
 * Invalida la caché de sesión (para forzar refetch en la próxima llamada).
 * Útil cuando el usuario acaba de conectar una nueva cuenta.
 */
export function invalidateSessionCache(): void {
  const chrome = (typeof globalThis !== 'undefined' && (globalThis as any).chrome) ?? undefined;
  if (chrome?.storage?.local) {
    chrome.storage.local.remove([STORAGE_KEY_SESSION, STORAGE_KEY_FETCHED_AT], () => {
      console.log('[LegalMev Session] Caché de sesión invalidada');
    });
  }
}
