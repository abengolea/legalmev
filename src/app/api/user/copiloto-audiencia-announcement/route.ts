import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  AUDIENCIA_COPILOT_TRIAL_SESSIONS,
  resolveAudienciaCopilotAccess,
} from '@/lib/audiencia-copilot-access';

async function authUid(request: NextRequest): Promise<
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) };
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 }) };
  }
}

/**
 * GET /api/user/copiloto-audiencia-announcement
 * Indica si mostrar el modal de novedad del Copiloto de Audiencias.
 */
export async function GET(request: NextRequest) {
  const auth = await authUid(request);
  if (!auth.ok) return auth.response;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.exists ? userSnap.data() : undefined;

  if (userData?.copilotoAudienciaAnnouncementDismissed === true) {
    return NextResponse.json({ ok: true, show: false, reason: 'dismissed' });
  }

  const audienciaCopilot = resolveAudienciaCopilotAccess({
    email: userData?.email as string | undefined,
    audienciaCopilotTrial: userData?.audienciaCopilotTrial as
      | import('@/lib/audiencia-copilot-access').AudienciaCopilotTrial
      | undefined,
  });

  const userName =
    (typeof userData?.name === 'string' && userData.name.trim()) ||
    (typeof userData?.email === 'string' ? userData.email.split('@')[0] : 'colega');

  const premiumSource = userData?.premiumSource as string | undefined;
  const colegioName =
    typeof userData?.colegioName === 'string' ? userData.colegioName : undefined;
  const tieneConvenioColegio =
    premiumSource === 'colegio' || !!userData?.colegioId;

  return NextResponse.json({
    ok: true,
    show: true,
    userName,
    hasCopilotAccess: audienciaCopilot.hasAccess,
    copilotUnlimited: audienciaCopilot.unlimited,
    trialLimit: audienciaCopilot.limit ?? AUDIENCIA_COPILOT_TRIAL_SESSIONS,
    trialRemaining: audienciaCopilot.remaining ?? AUDIENCIA_COPILOT_TRIAL_SESSIONS,
    trialUsed: audienciaCopilot.used ?? 0,
    tieneConvenioColegio,
    colegioName,
  });
}

/**
 * POST /api/user/copiloto-audiencia-announcement
 * Body: { dismiss: true }
 */
export async function POST(request: NextRequest) {
  const auth = await authUid(request);
  if (!auth.ok) return auth.response;

  let body: { dismiss?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  if (body.dismiss !== true) {
    return NextResponse.json({ ok: false, error: 'Solo se admite dismiss: true' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  await adminDb.collection('users').doc(auth.uid).set(
    {
      copilotoAudienciaAnnouncementDismissed: true,
      copilotoAudienciaAnnouncementDismissedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
