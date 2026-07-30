import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import {
  buildDefaultControlPruebaTrial,
  CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT,
} from '@/lib/control-prueba-access';

const MIN_LIMIT = 1;
const MAX_LIMIT = 999;

async function parseLimit(request: NextRequest): Promise<number | NextResponse> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Sin body → default
  }

  const raw =
    body && typeof body === 'object' && 'limit' in body
      ? (body as { limit: unknown }).limit
      : undefined;

  if (raw === undefined || raw === null || raw === '') {
    return CONTROL_PRUEBA_TRIAL_ADMIN_LIMIT;
  }

  const limit = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return NextResponse.json(
      { ok: false, error: `El límite debe ser un entero entre ${MIN_LIMIT} y ${MAX_LIMIT}` },
      { status: 400 },
    );
  }
  return limit;
}

/**
 * POST /api/admin/users/[id]/control-prueba-trial
 * Habilita o renueva la prueba de Control de prueba.
 * Body opcional: { limit: number } (default: 10/mes).
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

    const limitOrError = await parseLimit(request);
    if (limitOrError instanceof NextResponse) return limitOrError;
    const limit = limitOrError;

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const trial = buildDefaultControlPruebaTrial(auth.uid, limit);

    await userRef.update({
      controlPruebaTrial: trial,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: `Control de prueba habilitado (${limit} controles/mes)`,
      limit,
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
