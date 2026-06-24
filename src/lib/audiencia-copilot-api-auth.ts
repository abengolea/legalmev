import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';
import {
  resolveAudienciaCopilotAccess,
  type AudienciaCopilotTrial,
} from '@/lib/audiencia-copilot-access';

export async function authorizeAudienciaCopilot(
  request: NextRequest
): Promise<{ uid: string; unlimited: boolean } | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.data();

  if (!userSnap.exists || !userData) {
    return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  const access = resolveAudienciaCopilotAccess({
    email: userData.email as string | undefined,
    audienciaCopilotTrial: userData.audienciaCopilotTrial as AudienciaCopilotTrial | undefined,
  });

  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: 'Acceso restringido al copiloto de audiencias' },
      { status: 403 }
    );
  }

  return { uid: auth.uid, unlimited: access.unlimited, access };
}
