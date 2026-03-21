import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuthWithDevice } from '@/lib/require-auth-device';
import { maybeDowngradeLapsedSubscription, canUseFreeDownloads } from '@/lib/subscription-lapse';

const FREE_QUOTA = 5;
const PREMIUM_QUOTA_DEFAULT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
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
 * Requiere un solo dispositivo autorizado por cuenta.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthWithDevice(request);
    if (!authResult.ok) {
      const status = authResult.status === 403 ? 403 : 401;
      return NextResponse.json(
        {
          authenticated: false,
          userId: '',
          email: '',
          plan: 'free' as const,
          remainingQueries: null,
          error: authResult.error,
        },
        { status, headers: corsHeaders }
      );
    }

    const { uid, userData } = authResult;
    const adminDb = getAdminDb();
    let tier = userData.tier ?? 'free';
    let effectiveUserData = userData;

    const downgraded = await maybeDowngradeLapsedSubscription(adminDb, uid, userData as import('@/lib/subscription-lapse').UserData);
    if (downgraded) {
      tier = 'free';
      effectiveUserData = { ...userData, tier: 'free', subscriptionLapsed: true };
    }

    const email = (effectiveUserData.email as string) ?? '';
    const now = new Date();

    // Obtener cuota premium (global o por colegio)
    const paymentsSnap = await adminDb.doc('settings/payments').get();
    const payments = paymentsSnap.data();
    const globalQuota =
      payments?.premiumQuotaPerMonth && payments.premiumQuotaPerMonth > 0
        ? payments.premiumQuotaPerMonth
        : PREMIUM_QUOTA_DEFAULT;

    let premiumQuota = globalQuota;
    const isColegio = effectiveUserData.premiumSource === 'colegio' && effectiveUserData.colegioId;
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
      if (!canUseFreeDownloads(effectiveUserData as import('@/lib/subscription-lapse').UserData)) {
        remainingQueries = 0;
      } else {
        const used = effectiveUserData.freeDownloadsUsed ?? 0;
        remainingQueries = Math.max(0, FREE_QUOTA - used);
      }
    } else {
      // premium: pro (pago) o unlimited (colegio convenio)
      plan = isColegio ? 'unlimited' : 'pro';
      if (plan === 'unlimited') {
        remainingQueries = null; // Sin límite práctico para convenios
      } else {
        let used = effectiveUserData.downloadsThisMonth ?? 0;
        const resetAt = effectiveUserData.monthlyResetAt ? new Date(effectiveUserData.monthlyResetAt) : null;
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
