import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { isColegioResponsableEmail, isKnownPlatformAdminEmail } from '@/lib/platform-admin';

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
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const { uid } = auth;

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if ('role' in body) {
      if (targetUserId === uid) {
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

    if (update.role === 'admin') {
      const email = (userSnap.data()?.email as string) || '';
      if (
        !isKnownPlatformAdminEmail(email) &&
        (await isColegioResponsableEmail(adminDb, email))
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'No se puede asignar admin de plataforma: el usuario es responsable de un colegio. Quitá el email de adminEmails del colegio primero.',
          },
          { status: 400 }
        );
      }
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
