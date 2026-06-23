import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { AUDIENCIA_COPILOT_TRIAL_SESSIONS } from '@/lib/audiencia-copilot-access';

/**
 * POST /api/admin/users/[id]/audiencia-copilot-trial
 * Otorga prueba gratuita del copiloto de audiencias (3 sesiones).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const now = new Date().toISOString();
    await userRef.update({
      audienciaCopilotTrial: {
        limit: AUDIENCIA_COPILOT_TRIAL_SESSIONS,
        used: 0,
        grantedAt: now,
        grantedBy: auth.uid,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Prueba de copiloto otorgada (${AUDIENCIA_COPILOT_TRIAL_SESSIONS} audiencias)`,
    });
  } catch (err) {
    console.error('[admin/users/audiencia-copilot-trial] POST error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/audiencia-copilot-trial
 * Revoca la prueba del copiloto de audiencias.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      audienciaCopilotTrial: FieldValue.delete(),
    });

    return NextResponse.json({ ok: true, message: 'Prueba de copiloto revocada' });
  } catch (err) {
    console.error('[admin/users/audiencia-copilot-trial] DELETE error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
