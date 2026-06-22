import { normalizeEmail } from '@/lib/platform-admin';

/** Emails con acceso beta al copiloto de audiencias (superadmin de prueba). */
export function getAudienciaCopilotEmails(): Set<string> {
  const raw = process.env.AUDIENCIA_COPILOT_EMAILS || 'abengolea1@gmail.com';
  return new Set(
    raw
      .split(',')
      .map((e) => normalizeEmail(e))
      .filter(Boolean)
  );
}

export function canAccessAudienciaCopilot(email: string | undefined | null): boolean {
  return getAudienciaCopilotEmails().has(normalizeEmail(email));
}
