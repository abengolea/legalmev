import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

export type AuthDeviceResult =
  | { ok: true; uid: string; userData: Record<string, unknown> }
  | { ok: false; status: number; error: string };

const DEVICE_ERROR = 'Esta cuenta está en uso en otro dispositivo. Solo se permite un dispositivo. Iniciá sesión de nuevo para usar este.';

/**
 * Verifica token Bearer y que el dispositivo esté autorizado.
 * - Si el usuario no tiene authorizedDeviceId, se registra este como el primero (migración).
 * - Si no coincide, devuelve 403.
 */
export async function requireAuthWithDevice(request: NextRequest): Promise<AuthDeviceResult> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const deviceId = request.headers.get('X-Device-Id')?.trim() || '';

  if (!token) {
    return { ok: false, status: 401, error: 'No autenticado' };
  }

  if (!deviceId) {
    return { ok: false, status: 403, error: DEVICE_ERROR };
  }

  try {
    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;

    if (!userSnap.exists || !userData) {
      return { ok: false, status: 403, error: 'Usuario no encontrado' };
    }

    const authorizedDeviceId = userData?.authorizedDeviceId as string | undefined;

    if (!authorizedDeviceId) {
      // Migración: primer dispositivo que hace request se registra
      await adminDb.collection('users').doc(uid).set(
        { authorizedDeviceId: deviceId, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      return { ok: true, uid, userData };
    }

    if (authorizedDeviceId !== deviceId) {
      return { ok: false, status: 403, error: DEVICE_ERROR };
    }

    return { ok: true, uid, userData };
  } catch {
    return { ok: false, status: 401, error: 'Token inválido o expirado' };
  }
}
