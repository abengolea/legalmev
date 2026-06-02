import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * PATCH /api/admin/users/[id]/block
 * Bloquea o desbloquea un usuario. Solo admins.
 * Body: { disabled: boolean }
 * - disabled: true = bloquea (no puede iniciar sesión)
 * - disabled: false = desbloquea
 * También actualiza status en Firestore (bloqueado/activo)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminAuth = getAuth();
    const adminDb = getAdminDb();
    const { uid } = auth;

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    if (targetUserId === uid) {
      return NextResponse.json(
        { ok: false, error: 'No podés bloquear tu propia cuenta' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const disabled = body?.disabled === true;

    try {
      await adminAuth.updateUser(targetUserId, { disabled });
    } catch (authErr: unknown) {
      const msg = String(authErr instanceof Error ? authErr.message : 'Error');
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('USER_NOT_FOUND')) {
        // Usuario invitado sin cuenta Auth: solo actualizar Firestore
        console.warn('[block] Usuario sin Auth, actualizando solo Firestore:', targetUserId);
      } else {
        throw authErr;
      }
    }

    await adminDb.collection('users').doc(targetUserId).update({
      status: disabled ? 'bloqueado' : 'activo',
    });

    return NextResponse.json({
      ok: true,
      message: disabled ? 'Cuenta bloqueada' : 'Cuenta desbloqueada',
    });
  } catch (err) {
    console.error('[block]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
