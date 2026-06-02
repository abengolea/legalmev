import type { Firestore } from 'firebase-admin/firestore';

/** Email normalizado del usuario responsable de un colegio (adminEmails). */
export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? '').toString().trim().toLowerCase();
}

/** Emails de superadmins LegalMev (nunca deben tratarse como solo responsables de colegio). */
export function getPlatformAdminEmails(): Set<string> {
  const raw =
    process.env.PLATFORM_ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    'abengolea1@gmail.com';
  return new Set(
    raw
      .split(',')
      .map((e) => normalizeEmail(e))
      .filter(Boolean)
  );
}

export function isKnownPlatformAdminEmail(email: string | undefined | null): boolean {
  return getPlatformAdminEmails().has(normalizeEmail(email));
}

/** True si el email figura como responsable en algún colegio. */
export async function isColegioResponsableEmail(
  adminDb: Firestore,
  email: string
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const snap = await adminDb
    .collection('colegios')
    .where('adminEmails', 'array-contains', normalized)
    .limit(1)
    .get();

  return !snap.empty;
}

/**
 * Superadmin LegalMev: role=admin en Firestore.
 * Los responsables de colegio usan role=abogado + adminEmails del colegio.
 */
export async function isPlatformAdminUser(
  adminDb: Firestore,
  uid: string
): Promise<boolean> {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const userData = userSnap.data();
  if (!userSnap.exists || !userData) return false;
  return userData.role === 'admin';
}

/**
 * Responsable de colegio para UI/API de colegio: email en adminEmails
 * y NO superadmin de plataforma.
 */
export async function isColegioAdminUser(
  adminDb: Firestore,
  uid: string
): Promise<boolean> {
  const userSnap = await adminDb.collection('users').doc(uid).get();
  const userData = userSnap.data();
  if (!userSnap.exists || !userData) return false;

  const email = normalizeEmail(userData.email as string | undefined);
  if (!email || isKnownPlatformAdminEmail(email)) return false;
  if (userData.role === 'admin') return false;

  return isColegioResponsableEmail(adminDb, email);
}
