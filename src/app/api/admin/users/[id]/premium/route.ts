import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * PATCH /api/admin/users/[id]/premium
 * Asigna premium a un usuario. Solo admins.
 * Body: { type: 'monthly' | 'forever' }
 *
 * - monthly: premium por 30 días con cuota mensual estándar
 * - forever: premium permanente sin límite de descargas
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const body = await request.json();
    const type = body?.type as string;
    if (type !== 'monthly' && type !== 'forever') {
      return NextResponse.json(
        { ok: false, error: 'type debe ser "monthly" o "forever"' },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const now = new Date();
    const baseUpdate: Record<string, unknown> = {
      tier: 'premium',
      premiumSource: 'admin',
      premiumActivatedAt: now.toISOString(),
      downloadsThisMonth: 0,
    };

    if (type === 'monthly') {
      baseUpdate.monthlyResetAt = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      baseUpdate.premiumForever = false;
    } else {
      baseUpdate.premiumForever = true;
      baseUpdate.monthlyResetAt = null;
    }

    await userRef.update(baseUpdate);

    return NextResponse.json({
      ok: true,
      message:
        type === 'monthly' ? 'Premium mensual asignado' : 'Premium permanente asignado',
    });
  } catch (err) {
    console.error('[admin/users/premium] PATCH error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/premium
 * Revoca el premium de un usuario. Solo admins.
 * Devuelve al usuario a plan free.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    await userRef.update({
      tier: 'free',
      premiumSource: null,
      premiumActivatedAt: null,
      premiumForever: null,
      monthlyResetAt: null,
      downloadsThisMonth: 0,
    });

    return NextResponse.json({ ok: true, message: 'Premium revocado' });
  } catch (err) {
    console.error('[admin/users/premium] DELETE error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
