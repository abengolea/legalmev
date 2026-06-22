import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { canAccessAudienciaCopilot } from '@/lib/audiencia-copilot-access';

export async function authorizeAudienciaCopilot(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const auth = await requirePlatformAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const email = userSnap.data()?.email as string | undefined;

  if (!canAccessAudienciaCopilot(email)) {
    return NextResponse.json(
      { ok: false, error: 'Acceso restringido al copiloto de audiencias' },
      { status: 403 }
    );
  }

  return { uid: auth.uid };
}
