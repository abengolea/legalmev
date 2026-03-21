import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { ok: false as const, error: 'No autenticado', status: 401 };
  return { token };
}

/**
 * PATCH /api/admin/users/[id]
 * Actualiza rol y/o notas admin de un usuario. Solo admins.
 * Body: { role?: 'admin' | 'abogado', adminNotes?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(auth.token);
    const adminDb = getAdminDb();
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ('role' in body) {
      if (targetUserId === decoded.uid) {
        return NextResponse.json(
          { ok: false, error: 'No podés cambiar tu propio rol' },
          { status: 400 }
        );
      }
      const role = body.role as string;
      if (role === 'admin' || role === 'abogado') {
        update.role = role;
      }
    }
    if ('adminNotes' in body) {
      update.adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.trim() : '';
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    await userRef.update(update);
    return NextResponse.json({ ok: true, message: 'Actualizado' });
  } catch (err) {
    console.error('[admin/users] PATCH error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
