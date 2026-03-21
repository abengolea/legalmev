import type { Firestore } from 'firebase-admin/firestore';

export type MemberEstado = 'activo' | 'suspendido';

export type ColegioMember = {
  email: string;
  name: string;
  estado?: MemberEstado;
};

/** Normaliza miembros: sin estado = activo (retrocompatibilidad) */
export function normalizeMembers(members: ColegioMember[] | undefined): ColegioMember[] {
  if (!Array.isArray(members)) return [];
  return members.map((m) => ({
    email: String(m?.email || '').toLowerCase().trim(),
    name: String(m?.name || m?.email || '').trim(),
    estado: (m?.estado === 'suspendido' ? 'suspendido' : 'activo') as MemberEstado,
  })).filter((m) => m.email);
}

/** Actualiza tier de usuarios según estado en colegio. Devuelve cantidad activados y suspendidos. */
export async function syncUserTiersForColegio(
  adminDb: Firestore,
  colegioId: string,
  colegioName: string,
  members: ColegioMember[]
): Promise<{ activated: number; suspended: number }> {
  const activoEmails = new Set(
    members.filter((m) => m.estado !== 'suspendido').map((m) => m.email)
  );
  const memberByEmail = new Map<string, ColegioMember>();
  for (const m of members) memberByEmail.set(m.email, m);

  let activated = 0;
  let suspended = 0;

  // 1. Usuarios que ya tienen este colegio: activar o suspender según membresía
  const usersConColegio = await adminDb.collection('users').where('colegioId', '==', colegioId).get();
  const batch = adminDb.batch();
  for (const doc of usersConColegio.docs) {
    const data = doc.data();
    const email = String(data?.email || '').toLowerCase();
    const shouldBePremium = activoEmails.has(email);

    if (shouldBePremium) {
      batch.update(doc.ref, {
        tier: 'premium',
        colegioId,
        premiumSource: 'colegio',
        colegioName,
        colegioSuspended: null,
        downloadsThisMonth: 0,
        monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (data?.tier !== 'premium') activated++;
    } else {
      // Mantener colegioId y colegioName para poder informar al usuario en el dashboard
      batch.update(doc.ref, {
        tier: 'free',
        premiumSource: null,
        colegioSuspended: true,
        updatedAt: new Date().toISOString(),
      });
      if (data?.tier === 'premium') suspended++;
    }
  }
  const processedEmails = new Set(usersConColegio.docs.map((d) => String(d.data()?.email || '').toLowerCase()));
  await batch.commit();

  // 2. Miembros activos que tienen cuenta pero no tenían este colegio: activarlos
  for (const email of activoEmails) {
    if (processedEmails.has(email)) continue;
    const usersSnap = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (usersSnap.empty) continue;
    const doc = usersSnap.docs[0];
    const data = doc.data();
    if (data?.colegioId === colegioId && data?.tier === 'premium') continue;
    await doc.ref.update({
      tier: 'premium',
      colegioId,
      premiumSource: 'colegio',
      colegioName,
      colegioSuspended: null,
      downloadsThisMonth: 0,
      monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    activated++;
  }

  return { activated, suspended };
}
