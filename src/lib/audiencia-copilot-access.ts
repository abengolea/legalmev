import { normalizeEmail } from '@/lib/platform-admin';

/** Audiencias incluidas en la prueba gratuita de cada cuenta registrada. */
export const AUDIENCIA_COPILOT_TRIAL_SESSIONS = 1;

export function buildDefaultAudienciaCopilotTrial(
  grantedBy = 'registration',
  limit = AUDIENCIA_COPILOT_TRIAL_SESSIONS
): AudienciaCopilotTrial {
  return {
    limit,
    used: 0,
    grantedAt: new Date().toISOString(),
    grantedBy,
  };
}

export type AudienciaCopilotTrial = {
  limit: number;
  used: number;
  grantedAt: string;
  grantedBy?: string;
};

export type AudienciaCopilotUserFields = {
  email?: string | null;
  audienciaCopilotTrial?: AudienciaCopilotTrial | null;
};

export type AudienciaCopilotAccess = {
  hasAccess: boolean;
  unlimited: boolean;
  remaining: number | null;
  limit: number | null;
  used: number | null;
};

/** Emails con acceso ilimitado al copiloto (superadmin / beta interna). */
export function getAudienciaCopilotEmails(): Set<string> {
  const raw = process.env.AUDIENCIA_COPILOT_EMAILS || 'abengolea1@gmail.com';
  return new Set(
    raw
      .split(',')
      .map((e) => normalizeEmail(e))
      .filter(Boolean)
  );
}

export function hasUnlimitedAudienciaCopilotAccess(
  email: string | undefined | null
): boolean {
  return getAudienciaCopilotEmails().has(normalizeEmail(email));
}

export function resolveAudienciaCopilotAccess(
  user: AudienciaCopilotUserFields
): AudienciaCopilotAccess {
  if (hasUnlimitedAudienciaCopilotAccess(user.email)) {
    return { hasAccess: true, unlimited: true, remaining: null, limit: null, used: null };
  }

  const trial = user.audienciaCopilotTrial;
  if (trial && typeof trial.limit === 'number') {
    if (trial.limit <= 0) {
      const used = typeof trial.used === 'number' ? trial.used : 0;
      return { hasAccess: false, unlimited: false, remaining: 0, limit: 0, used };
    }
    const used = typeof trial.used === 'number' ? trial.used : 0;
    const remaining = Math.max(0, trial.limit - used);
    return {
      hasAccess: remaining > 0,
      unlimited: false,
      remaining,
      limit: trial.limit,
      used,
    };
  }

  // Prueba incluida al registrarse (usuarios existentes sin campo explícito).
  return {
    hasAccess: true,
    unlimited: false,
    remaining: AUDIENCIA_COPILOT_TRIAL_SESSIONS,
    limit: AUDIENCIA_COPILOT_TRIAL_SESSIONS,
    used: 0,
  };
}

/** Puede ver y usar el copiloto (prueba activa o acceso ilimitado). */
export function canAccessAudienciaCopilot(
  user: AudienciaCopilotUserFields | string | undefined | null
): boolean {
  if (typeof user === 'string' || user == null) {
    return hasUnlimitedAudienciaCopilotAccess(user);
  }
  return resolveAudienciaCopilotAccess(user).hasAccess;
}

/** Puede cargar un expediente nuevo (crear audiencia). */
export function canCreateAudienciaSession(user: AudienciaCopilotUserFields): boolean {
  const access = resolveAudienciaCopilotAccess(user);
  if (!access.hasAccess) return false;
  if (access.unlimited) return true;
  return (access.remaining ?? 0) > 0;
}
