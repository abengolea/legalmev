import type { Firestore } from 'firebase-admin/firestore';
import {
  canEditResource,
  canViewResource,
  getOwnerUid,
  isResourceOwner,
  resolveResourceAccess,
  type ResourceAccessLevel,
} from '@/lib/resource-sharing';

export const AUDIENCIA_SESSIONS_COLLECTION = 'audiencia_sessions';

export async function assertAudienciaSessionAccess(
  adminDb: Firestore,
  sessionId: string,
  uid: string,
  min: 'view' | 'edit' | 'owner' = 'view',
): Promise<
  | {
      ok: true;
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
      access: ResourceAccessLevel;
      ownerUid: string;
      id: string;
    }
  | { ok: false; error: string; status: number }
> {
  const ref = adminDb.collection(AUDIENCIA_SESSIONS_COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: 'Sesión no encontrada', status: 404 };
  }

  const data = snap.data() ?? {};
  const access = resolveResourceAccess(data, uid, 'userId');
  const ownerUid = getOwnerUid(data, 'userId') ?? '';

  const allowed =
    min === 'owner'
      ? isResourceOwner(access)
      : min === 'edit'
        ? canEditResource(access)
        : canViewResource(access);

  if (!allowed || !access) {
    return { ok: false, error: 'Sin permiso', status: 403 };
  }

  return { ok: true, ref, data, access, ownerUid, id: snap.id };
}
