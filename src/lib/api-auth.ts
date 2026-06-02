import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { isPlatformAdminUser } from '@/lib/platform-admin';

export async function verifyUidFromRequest(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 });
  }
}

/** Superadmin LegalMev (role=admin, no responsable de colegio). */
export async function requirePlatformAdmin(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  if (!(await isPlatformAdminUser(adminDb, auth.uid))) {
    return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
  }
  return { uid: auth.uid };
}
