import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

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

/** Usuario con role=admin en Firestore (superadmin LegalMev). */
export async function requirePlatformAdmin(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  if (userSnap.data()?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
  }
  return { uid: auth.uid };
}
