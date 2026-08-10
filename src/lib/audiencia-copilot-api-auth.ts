import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';
import {
  resolveAudienciaCopilotAccess,
  type AudienciaCopilotAccess,
  type AudienciaCopilotTrial,
} from '@/lib/audiencia-copilot-access';

export type AudienciaCopilotAuth = {
  uid: string;
  unlimited: boolean;
  access: AudienciaCopilotAccess;
  userData: Record<string, unknown>;
};

export async function authorizeAudienciaCopilot(
  request: NextRequest
): Promise<AudienciaCopilotAuth | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.data();

  if (!userSnap.exists || !userData) {
    return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  const status = String(userData.status ?? 'activo').trim().toLowerCase();
  if (status === 'bloqueado' || status === 'inactivo') {
    return NextResponse.json({ ok: false, error: 'Usuario inactivo' }, { status: 403 });
  }

  const access = resolveAudienciaCopilotAccess({
    email: userData.email as string | undefined,
    audienciaCopilotTrial: userData.audienciaCopilotTrial as AudienciaCopilotTrial | undefined,
  });

  // Usuarios registrados pueden abrir sesiones compartidas aunque no tengan cupo propio.
  return {
    uid: auth.uid,
    unlimited: access.unlimited,
    access,
    userData,
  };
}
