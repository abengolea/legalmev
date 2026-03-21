import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/auth/claim-device
 * Se llama después del login. Revoca sesiones anteriores y registra este dispositivo como autorizado.
 * Body: { deviceId: string }
 * Headers: Authorization: Bearer <token>
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: 'deviceId es requerido' }, { status: 400 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Revocar todos los refresh tokens anteriores (cierra sesiones en otras PCs)
    await adminAuth.revokeRefreshTokens(uid);

    // Registrar este dispositivo como el único autorizado
    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(uid).set(
      { authorizedDeviceId: deviceId, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[claim-device] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al registrar dispositivo' },
      { status: 500 }
    );
  }
}
