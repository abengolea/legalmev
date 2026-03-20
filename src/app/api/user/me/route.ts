import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/user/me
 * Retorna los datos del usuario autenticado (nombre, email, role, etc.).
 * Requiere Bearer token en Authorization.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const data = userSnap.data();

    if (!userSnap.exists || !data) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: uid,
        name: data.name,
        email: data.email,
        role: data.role ?? 'abogado',
        status: data.status,
        tier: data.tier ?? 'free',
        cuit: data.cuit ?? '',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * PATCH /api/user/me
 * Actualiza perfil del usuario (nombre, cuit). Requiere Bearer token.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ('name' in body && typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim();
    }
    if ('cuit' in body) {
      const cuit = typeof body.cuit === 'string' ? body.cuit.trim().replace(/\D/g, '') : '';
      update.cuit = cuit || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(uid).update(update);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
