/** Versión del aviso. Al cambiarla, los usuarios deben volver a aceptar. */
export const EXPEDIENTE_IA_CONSENT_VERSION = '2026-07-30-encargo';

const STORAGE_KEY = 'legalmev_expediente_ia_consent';

export function hasExpedienteIaConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === EXPEDIENTE_IA_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function acceptExpedienteIaConsent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, EXPEDIENTE_IA_CONSENT_VERSION);
  } catch {
    // ignore quota / private mode
  }
}
