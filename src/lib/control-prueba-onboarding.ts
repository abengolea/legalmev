const STORAGE_KEY = 'legalmev.control-prueba.onboarding.v1';
export const CONTROL_PRUEBA_ONBOARDING_VERSION = 'v1';

function getLocalStorage(): Storage | null {
  try {
    const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
    return storage ?? null;
  } catch {
    return null;
  }
}

export function hasControlPruebaOnboardingSeen(): boolean {
  try {
    return getLocalStorage()?.getItem(STORAGE_KEY) === CONTROL_PRUEBA_ONBOARDING_VERSION;
  } catch {
    return false;
  }
}

export function markControlPruebaOnboardingSeen(): void {
  try {
    getLocalStorage()?.setItem(STORAGE_KEY, CONTROL_PRUEBA_ONBOARDING_VERSION);
  } catch {
    // ignore quota / private mode
  }
}
