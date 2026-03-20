import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

const FREE_QUOTA = 5;
const PREMIUM_QUOTA_DEFAULT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export type ExtensionSessionPlan = 'free' | 'pro' | 'unlimited';

export type ExtensionSessionResponse = {
  authenticated: boolean;
  userId: string;
  email: string;
  plan: ExtensionSessionPlan;
  remainingQueries: number | null;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/extension/session
 * Valida el token Bearer y devuelve la sesión actual del usuario.
 * Usado por la extensión para validar sesión antes de cualquier acción.
 * NUNCA confiar en caché local: siempre validar contra este endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, userId: '', email: '', plan: 'free' as const, remainingQueries: null },
        { status: 200, headers: corsHeaders }
      );
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();

    if (!userSnap.exists || !userData) {
      return NextResponse.json(
        { authenticated: false, userId: '', email: '', plan: 'free' as const, remainingQueries: null },
        { status: 200, headers: corsHeaders }
      );
    }

    const tier = userData.tier ?? 'free';
    const email = decoded.email ?? userData.email ?? '';
    const now = new Date();

    // Obtener cuota premium (global o por colegio)
    const paymentsSnap = await adminDb.doc('settings/payments').get();
    const payments = paymentsSnap.data();
    const globalQuota =
      payments?.premiumQuotaPerMonth && payments.premiumQuotaPerMonth > 0
        ? payments.premiumQuotaPerMonth
        : PREMIUM_QUOTA_DEFAULT;

    let premiumQuota = globalQuota;
    const isColegio = userData.premiumSource === 'colegio' && userData.colegioId;
    if (isColegio) {
      const colegioSnap = await adminDb.collection('colegios').doc(userData.colegioId).get();
      const colegioData = colegioSnap.data();
      if (colegioData?.cuotaMensual != null && colegioData.cuotaMensual > 0) {
        premiumQuota = colegioData.cuotaMensual;
      }
    }

    let plan: ExtensionSessionPlan = 'free';
    let remainingQueries: number | null = null;

    if (tier === 'free') {
      plan = 'free';
      const used = userData.freeDownloadsUsed ?? 0;
      remainingQueries = Math.max(0, FREE_QUOTA - used);
    } else {
      // premium: pro (pago) o unlimited (colegio convenio)
      plan = isColegio ? 'unlimited' : 'pro';
      if (plan === 'unlimited') {
        remainingQueries = null; // Sin límite práctico para convenios
      } else {
        let used = userData.downloadsThisMonth ?? 0;
        const resetAt = userData.monthlyResetAt ? new Date(userData.monthlyResetAt) : null;
        if (resetAt && now >= resetAt) {
          used = 0;
        }
        remainingQueries = Math.max(0, premiumQuota - used);
      }
    }

    const session: ExtensionSessionResponse = {
      authenticated: true,
      userId: uid,
      email,
      plan,
      remainingQueries,
    };

    return NextResponse.json(session, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { authenticated: false, userId: '', email: '', plan: 'free' as const, remainingQueries: null },
      { status: 200, headers: corsHeaders }
    );
  }
}
