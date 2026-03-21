import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

const GRACE_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export type UserData = {
  tier?: string;
  premiumSource?: string;
  paymentRejectedAt?: string;
  subscriptionLapsed?: boolean;
  [key: string]: unknown;
};

/**
 * Si el usuario es premium por pago y el rechazo lleva más de 10 días,
 * lo degrada a free con subscriptionLapsed=true (sin descargas gratuitas).
 * Retorna true si se hizo el downgrade.
 */
export async function maybeDowngradeLapsedSubscription(
  db: Firestore,
  uid: string,
  userData: UserData
): Promise<boolean> {
  if (userData.tier !== 'premium' || userData.premiumSource !== 'payment') {
    return false;
  }
  const rejectedAt = userData.paymentRejectedAt;
  if (!rejectedAt) return false;

  const rejectedDate = new Date(rejectedAt);
  const cutoff = new Date(Date.now() - GRACE_DAYS_MS);
  if (rejectedDate > cutoff) return false;

  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    tier: 'free',
    subscriptionLapsed: true,
    paymentRejectedAt: FieldValue.delete(),
    paymentRejectedWarningSentAt: FieldValue.delete(),
  });
  return true;
}

/**
 * Indica si el usuario free tiene derecho a las 5 descargas gratuitas.
 * Solo usuarios que NUNCA tuvieron premium las tienen.
 * subscriptionLapsed = ex-premium que no renovó → 0 descargas.
 */
export function canUseFreeDownloads(userData: UserData): boolean {
  if (userData.subscriptionLapsed === true) return false;
  return true;
}
