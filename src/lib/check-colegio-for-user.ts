import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeMembers, type ColegioMember } from '@/lib/colegio-members';

export type CheckColegioResult =
  | { ok: true; alreadyPremium: true; premiumSource?: string | null; colegioName?: string }
  | { ok: true; premiumFromColegio: true; colegioName: string }
  | { ok: true; colegioSuspended: true; colegioName: string }
  | { ok: true; notInColegio: true }
  | { ok: true; noEmail: true }
  | { ok: true; profileCreated: true };

function colegioPremiumUpdate(
  colegioId: string,
  colegioName: string,
  resetDownloads: boolean
): Record<string, unknown> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    tier: 'premium',
    colegioId,
    premiumSource: 'colegio',
    colegioName,
    colegioSuspended: null,
    premiumForever: null,
    updatedAt: now,
  };
  if (resetDownloads) {
    update.downloadsThisMonth = 0;
    update.monthlyResetAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  return update;
}

/** Asegura perfil Firestore para cuentas Auth sin documento (p. ej. primer login con Google). */
export async function ensureUserProfile(
  adminDb: Firestore,
  adminAuth: Auth,
  uid: string
): Promise<{ email: string; created: boolean } | null> {
  const userRef = adminDb.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    const data = existing.data();
    const email = String(data?.email || '').toLowerCase().trim();
    if (email && data?.email !== email) {
      await userRef.update({ email, updatedAt: new Date().toISOString() });
    }
    return email ? { email, created: false } : null;
  }

  const authUser = await adminAuth.getUser(uid);
  const email = String(authUser.email || '').toLowerCase().trim();
  if (!email) return null;

  await userRef.set({
    name: authUser.displayName?.trim() || email.split('@')[0],
    email,
    role: 'abogado',
    status: 'activo',
    tier: 'free',
    freeDownloadsUsed: 0,
    phone: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { email, created: true };
}

/**
 * Vincula premium por colegio si el email está en un convenio activo.
 * Idempotente: puede llamarse en registro, login o sync manual.
 */
export async function checkColegioForUser(
  adminDb: Firestore,
  adminAuth: Auth,
  uid: string
): Promise<CheckColegioResult> {
  const profile = await ensureUserProfile(adminDb, adminAuth, uid);
  if (!profile) return { ok: true, noEmail: true };

  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();
  if (!userSnap.exists || !userData) return { ok: true, noEmail: true };

  const email = profile.email;
  const premiumSource = userData.premiumSource as string | null | undefined;
  const tier = userData.tier as string | undefined;

  if (premiumSource === 'payment' && tier === 'premium') {
    return { ok: true, alreadyPremium: true, premiumSource: 'payment' };
  }

  const colegiosSnap = await adminDb.collection('colegios').where('convenioActivo', '==', true).get();

  type Match = { colegioId: string; colegioName: string; estado: 'activo' | 'suspendido' };
  let match: Match | null = null;

  for (const doc of colegiosSnap.docs) {
    const data = doc.data();
    const members = normalizeMembers(
      (data.members || []) as ColegioMember[]
    );
    const found = members.find((m) => m.email === email);
    if (found) {
      match = {
        colegioId: doc.id,
        colegioName: String(data.name || ''),
        estado: found.estado === 'suspendido' ? 'suspendido' : 'activo',
      };
      break;
    }
  }

  if (
    match &&
    premiumSource === 'colegio' &&
    tier === 'premium' &&
    userData.colegioId === match.colegioId &&
    match.estado === 'activo' &&
    userData.colegioSuspended !== true
  ) {
    return {
      ok: true,
      alreadyPremium: true,
      premiumSource: 'colegio',
      colegioName: match.colegioName,
    };
  }

  if (match?.estado === 'activo') {
    const resetDownloads = tier !== 'premium' || premiumSource !== 'colegio';
    await userRef.update(colegioPremiumUpdate(match.colegioId, match.colegioName, resetDownloads));
    return { ok: true, premiumFromColegio: true, colegioName: match.colegioName };
  }

  if (match?.estado === 'suspendido' && premiumSource === 'colegio') {
    await userRef.update({
      tier: 'free',
      premiumSource: null,
      colegioSuspended: true,
      colegioId: match.colegioId,
      colegioName: match.colegioName,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, colegioSuspended: true, colegioName: match.colegioName };
  }

  if (profile.created) return { ok: true, profileCreated: true };
  return { ok: true, notInColegio: true };
}
