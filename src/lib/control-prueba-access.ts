import type { Firestore } from 'firebase-admin/firestore';
import { isControlPruebaSuperAdminUser } from '@/lib/platform-admin';

/** Controles incluidos al registrarse (prueba para todos). */
export const CONTROL_PRUEBA_TRIAL_DEFAULT_LIMIT = 5;

/**
 * Controles por mes al habilitar/renovar desde admin.
 * Quienes ya tienen 10 conservan ese cupo.
 */
export const CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT = 10;

/** @deprecated Usar CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT o CONTROL_PRUEBA_TRIAL_DEFAULT_LIMIT */
export const CONTROL_PRUEBA_TRIAL_MONTHLY_LIMIT = CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export type ControlPruebaTrial = {
  limit: number;
  used: number;
  grantedAt: string;
  grantedBy?: string;
  monthlyResetAt?: string | null;
};

export type ControlPruebaUserFields = {
  email?: string | null;
  controlPruebaTrial?: ControlPruebaTrial | null;
};

export type ControlPruebaAccess = {
  hasAccess: boolean;
  unlimited: boolean;
  canCreate: boolean;
  remaining: number | null;
  limit: number | null;
  used: number | null;
  monthlyResetAt?: string | null;
};

/** Prueba automática al registrarse: 5 controles en total (sin renovación mensual). */
export function buildRegistrationControlPruebaTrial(
  grantedBy = 'registration'
): ControlPruebaTrial {
  return {
    limit: CONTROL_PRUEBA_TRIAL_DEFAULT_LIMIT,
    used: 0,
    grantedAt: new Date().toISOString(),
    grantedBy,
    monthlyResetAt: null,
  };
}

/** Prueba otorgada por admin: 10 controles por mes. */
export function buildDefaultControlPruebaTrial(grantedBy = 'admin'): ControlPruebaTrial {
  const now = new Date();
  return {
    limit: CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT,
    used: 0,
    grantedAt: now.toISOString(),
    grantedBy,
    monthlyResetAt: new Date(now.getTime() + MONTH_MS).toISOString(),
  };
}

function effectiveTrialUsage(trial: ControlPruebaTrial, now = new Date()): {
  used: number;
  limit: number;
  remaining: number;
  monthlyResetAt: string | null;
  shouldReset: boolean;
} {
  const limit =
    typeof trial.limit === 'number' ? trial.limit : CONTROL_PRUEBA_TRIAL_DEFAULT_LIMIT;
  let used = typeof trial.used === 'number' ? trial.used : 0;
  const resetAtRaw = trial.monthlyResetAt ?? null;
  const resetAt = resetAtRaw ? new Date(resetAtRaw) : null;
  const shouldReset = resetAt != null && !Number.isNaN(resetAt.getTime()) && now >= resetAt;

  if (shouldReset) {
    used = 0;
  }

  const nextResetAt = shouldReset
    ? new Date(now.getTime() + MONTH_MS).toISOString()
    : resetAtRaw;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    monthlyResetAt: nextResetAt,
    shouldReset,
  };
}

export async function maybeResetControlPruebaTrial(
  adminDb: Firestore,
  uid: string,
  trial: ControlPruebaTrial,
): Promise<ControlPruebaTrial> {
  const { shouldReset, monthlyResetAt } = effectiveTrialUsage(trial);
  if (!shouldReset) return trial;

  const next: ControlPruebaTrial = {
    ...trial,
    used: 0,
    monthlyResetAt,
  };

  await adminDb.collection('users').doc(uid).update({
    controlPruebaTrial: next,
    updatedAt: new Date().toISOString(),
  });

  return next;
}

/**
 * Garantiza prueba de Control de prueba.
 * - Sin trial → otorga 5 (registro).
 * - Con trial existente (incl. 10 admin) → no lo modifica ni reduce.
 */
export async function ensureControlPruebaTrialForUser(
  adminDb: Firestore,
  uid: string,
  user: ControlPruebaUserFields,
): Promise<ControlPruebaTrial> {
  const existing = user.controlPruebaTrial;
  if (existing && typeof existing.limit === 'number' && existing.limit > 0) {
    return existing;
  }

  const trial = buildRegistrationControlPruebaTrial('registration');
  await adminDb.collection('users').doc(uid).update({
    controlPruebaTrial: trial,
    updatedAt: new Date().toISOString(),
  });
  return trial;
}

export function resolveControlPruebaAccess(
  user: ControlPruebaUserFields,
  options?: { superAdmin?: boolean },
): ControlPruebaAccess {
  if (options?.superAdmin) {
    return {
      hasAccess: true,
      unlimited: true,
      canCreate: true,
      remaining: null,
      limit: null,
      used: null,
    };
  }

  const trial = user.controlPruebaTrial;
  if (!trial || typeof trial.limit !== 'number' || trial.limit <= 0) {
    return {
      hasAccess: false,
      unlimited: false,
      canCreate: false,
      remaining: 0,
      limit: 0,
      used: 0,
    };
  }

  const { used, limit, remaining, monthlyResetAt } = effectiveTrialUsage(trial);

  return {
    hasAccess: true,
    unlimited: false,
    canCreate: remaining > 0,
    remaining,
    limit,
    used,
    monthlyResetAt,
  };
}

export async function resolveControlPruebaAccessForUser(
  adminDb: Firestore,
  uid: string,
  user: ControlPruebaUserFields,
): Promise<ControlPruebaAccess> {
  const superAdmin = await isControlPruebaSuperAdminUser(adminDb, uid);
  if (superAdmin) {
    return resolveControlPruebaAccess(user, { superAdmin: true });
  }

  let trial = await ensureControlPruebaTrialForUser(adminDb, uid, user);
  if (trial && typeof trial.limit === 'number' && trial.limit > 0) {
    trial = await maybeResetControlPruebaTrial(adminDb, uid, trial);
  }

  return resolveControlPruebaAccess({ ...user, controlPruebaTrial: trial });
}

export async function consumeControlPruebaQuota(
  adminDb: Firestore,
  uid: string,
  user: ControlPruebaUserFields,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await resolveControlPruebaAccessForUser(adminDb, uid, user);
  if (!access.hasAccess) {
    return { ok: false, error: 'Sin acceso a Control de prueba' };
  }
  if (access.unlimited) {
    return { ok: true };
  }
  if (!access.canCreate) {
    const isMonthly = Boolean(user.controlPruebaTrial?.monthlyResetAt);
    return {
      ok: false,
      error: isMonthly
        ? `Alcanzaste el límite de ${access.limit ?? CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT} controles este mes. Se renueva automáticamente.`
        : `Alcanzaste el límite de ${access.limit ?? CONTROL_PRUEBA_TRIAL_DEFAULT_LIMIT} controles de prueba. Contactanos si necesitás más.`,
    };
  }

  const trial = user.controlPruebaTrial ?? (await ensureControlPruebaTrialForUser(adminDb, uid, user));
  const { monthlyResetAt, shouldReset } = effectiveTrialUsage(trial);
  const used = shouldReset ? 1 : (trial.used ?? 0) + 1;

  await adminDb.collection('users').doc(uid).update({
    controlPruebaTrial: {
      ...trial,
      used,
      monthlyResetAt: monthlyResetAt ?? null,
    },
    updatedAt: new Date().toISOString(),
  });

  return { ok: true };
}

export async function assertControlPruebaExpedienteOwner(
  adminDb: Firestore,
  expedienteId: string,
  uid: string,
): Promise<{ ok: true; data: FirebaseFirestore.DocumentData } | { ok: false; error: string; status: number }> {
  const snap = await adminDb.collection('controlPrueba').doc(expedienteId).get();
  if (!snap.exists) {
    return { ok: false, error: 'Expediente no encontrado', status: 404 };
  }

  const data = snap.data() ?? {};
  if (data.createdBy !== uid) {
    return { ok: false, error: 'Sin permiso sobre este expediente', status: 403 };
  }

  return { ok: true, data };
}
