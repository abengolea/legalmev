import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

const SETTINGS_DOC = 'settings/payments';

/**
 * GET /api/admin/settings/payments
 * Lee la configuración de pagos. Requiere admin.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

    const docSnap = await adminDb.doc(SETTINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : {};

    return NextResponse.json({
      ok: true,
      settings: {
        stripePublishableKey: data?.stripePublishableKey ?? '',
        premiumPriceId: data?.premiumPriceId ?? '',
        premiumPriceAmount: data?.premiumPriceAmount ?? 0,
        premiumQuotaPerMonth: data?.premiumQuotaPerMonth ?? 100,
        currency: data?.currency ?? 'ARS',
        contactEmail: data?.contactEmail ?? 'contacto@legalmev.com',
        mercadopagoPublicKey: data?.mercadopagoPublicKey ?? '',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * PATCH /api/admin/settings/payments
 * Actualiza la configuración de pagos. Requiere admin.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

    const body = await request.json();
    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof body.stripePublishableKey === 'string') update.stripePublishableKey = body.stripePublishableKey;
    if (typeof body.premiumPriceId === 'string') update.premiumPriceId = body.premiumPriceId;
    if (typeof body.premiumPriceAmount === 'number') update.premiumPriceAmount = body.premiumPriceAmount;
    if (typeof body.premiumQuotaPerMonth === 'number' && body.premiumQuotaPerMonth > 0) update.premiumQuotaPerMonth = body.premiumQuotaPerMonth;
    if (typeof body.currency === 'string') update.currency = body.currency;
    if (typeof body.contactEmail === 'string') update.contactEmail = body.contactEmail;
    if (typeof body.mercadopagoPublicKey === 'string') update.mercadopagoPublicKey = body.mercadopagoPublicKey;

    await adminDb.doc(SETTINGS_DOC).set(update, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
