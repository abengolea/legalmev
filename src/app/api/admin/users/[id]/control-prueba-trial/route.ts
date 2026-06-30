import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import {
  buildDefaultControlPruebaTrial,
  CONTROL_PRUEBA_TRIAL_MONTHLY_LIMIT,
} from '@/lib/control-prueba-access';

/**
 * POST /api/admin/users/[id]/control-prueba-trial
 * Habilita la prueba de Control de prueba (10 controles por mes).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const trial = buildDefaultControlPruebaTrial(auth.uid);

    await userRef.update({
      controlPruebaTrial: trial,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `Control de prueba habilitado (${CONTROL_PRUEBA_TRIAL_MONTHLY_LIMIT} controles/mes)`,
    });
  } catch (err) {
    console.error('[admin/users/control-prueba-trial] POST error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/control-prueba-trial
 * Revoca el acceso de prueba a Control de prueba.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID de usuario requerido' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    await userRef.update({
      controlPruebaTrial: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, message: 'Prueba de Control de prueba revocada' });
  } catch (err) {
    console.error('[admin/users/control-prueba-trial] DELETE error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    );
  }
}
