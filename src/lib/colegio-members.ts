import type { DocumentData, Firestore, QueryDocumentSnapshot, UpdateData } from 'firebase-admin/firestore';
import { PDF_DOWNLOADS_UNLIMITED, lifetimePremiumUserFields } from '@/lib/pdf-downloads-policy';

export type MemberEstado = 'activo' | 'suspendido';

export type ColegioMember = {
  email: string;
  name: string;
  estado?: MemberEstado;
};

const FIRESTORE_IN_LIMIT = 30;
const FIRESTORE_BATCH_LIMIT = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Normaliza miembros: sin estado = activo (retrocompatibilidad) */
export function normalizeMembers(members: ColegioMember[] | undefined): ColegioMember[] {
  if (!Array.isArray(members)) return [];
  return members.map((m) => ({
    email: String(m?.email || '').toLowerCase().trim(),
    name: String(m?.name || m?.email || '').trim(),
    estado: (m?.estado === 'suspendido' ? 'suspendido' : 'activo') as MemberEstado,
  })).filter((m) => m.email);
}

function colegioPremiumFields(
  colegioId: string,
  colegioName: string
): UpdateData<DocumentData> {
  return {
    tier: 'premium',
    colegioId,
    premiumSource: 'colegio',
    colegioName,
    colegioSuspended: null,
    premiumForever: PDF_DOWNLOADS_UNLIMITED ? true : null,
    downloadsThisMonth: 0,
    monthlyResetAt: PDF_DOWNLOADS_UNLIMITED
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Actualiza tier de usuarios según estado en colegio. Devuelve cantidad activados y suspendidos. */
export async function syncUserTiersForColegio(
  adminDb: Firestore,
  colegioId: string,
  colegioName: string,
  members: ColegioMember[]
): Promise<{ activated: number; suspended: number }> {
  const normalized = normalizeMembers(members);
  const activoEmails = new Set(
    normalized.filter((m) => m.estado !== 'suspendido').map((m) => m.email)
  );

  let activated = 0;
  let suspended = 0;

  // 1. Usuarios que ya tienen este colegio: activar o suspender según membresía
  const usersConColegio = await adminDb.collection('users').where('colegioId', '==', colegioId).get();
  let batch = adminDb.batch();
  let batchOps = 0;

  const commitBatch = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = adminDb.batch();
    batchOps = 0;
  };

  for (const doc of usersConColegio.docs) {
    const data = doc.data();
    const email = String(data?.email || '').toLowerCase().trim();
    const shouldBePremium = activoEmails.has(email);

    if (shouldBePremium) {
      batch.update(doc.ref, colegioPremiumFields(colegioId, colegioName));
      if (data?.tier !== 'premium' || data?.premiumSource !== 'colegio') activated++;
    } else {
      batch.update(doc.ref, {
        ...(PDF_DOWNLOADS_UNLIMITED
          ? {
              ...lifetimePremiumUserFields('lifetime'),
              colegioSuspended: true,
            }
          : {
              tier: 'free',
              premiumSource: null,
              colegioSuspended: true,
            }),
        updatedAt: new Date().toISOString(),
      });
      if (data?.tier === 'premium' && data?.premiumSource === 'colegio') suspended++;
    }
    batchOps++;
    if (batchOps >= FIRESTORE_BATCH_LIMIT) await commitBatch();
  }
  await commitBatch();

  const processedEmails = new Set(
    usersConColegio.docs.map((d) => String(d.data()?.email || '').toLowerCase().trim())
  );

  // 2. Miembros activos con cuenta pero sin colegioId: activar en lotes (evita timeout con listas grandes)
  const pendingEmails = [...activoEmails].filter((e) => !processedEmails.has(e));
  const foundDocs = new Map<string, QueryDocumentSnapshot>();

  for (const emailChunk of chunk(pendingEmails, FIRESTORE_IN_LIMIT)) {
    const snap = await adminDb.collection('users').where('email', 'in', emailChunk).get();
    for (const doc of snap.docs) {
      const email = String(doc.data()?.email || '').toLowerCase().trim();
      if (email) foundDocs.set(email, doc);
    }
  }

  batch = adminDb.batch();
  batchOps = 0;

  for (const email of pendingEmails) {
    const doc = foundDocs.get(email);
    if (!doc) continue;

    const data = doc.data();
    if (data?.premiumSource === 'payment' && data?.tier === 'premium') continue;
    if (data?.colegioId === colegioId && data?.tier === 'premium' && data?.premiumSource === 'colegio') {
      continue;
    }

    const update = { ...colegioPremiumFields(colegioId, colegioName) };
    if (data?.email !== email) update.email = email;

    batch.update(doc.ref, update);
    activated++;
    batchOps++;
    if (batchOps >= FIRESTORE_BATCH_LIMIT) await commitBatch();
  }
  await commitBatch();

  return { activated, suspended };
}
