import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_DOC = 'settings/payments';

/**
 * GET /api/payments/config
 * Retorna si Mercado Pago está habilitado y el monto premium para mostrar en el dashboard.
 * No requiere autenticación (solo datos públicos para la UI).
 */
export async function GET() {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const dlocalApiKey = process.env.DLOCAL_API_KEY;
    const dlocalSecret = process.env.DLOCAL_SECRET_KEY;
    const dlocalEnabled = !!(dlocalApiKey?.trim() && dlocalSecret?.trim());

    const adminDb = getAdminDb();
    const docSnap = await adminDb.doc(SETTINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : {};

    const mercadopagoPublicKey = data?.mercadopagoPublicKey ?? '';
    const mercadopagoEnabled = !!(mercadopagoPublicKey?.trim() && accessToken?.trim());
    const premiumPriceAmount = (data?.premiumPriceAmount && data.premiumPriceAmount > 0)
      ? data.premiumPriceAmount
      : 0;
    const currency = data?.currency ?? 'ARS';

    const dlocalSubscriptionLink = (data?.dlocalSubscriptionLink as string) ?? '';
    const dlocalSubscriptionEnabled = !!dlocalSubscriptionLink.trim() && dlocalEnabled;

    return NextResponse.json({
      ok: true,
      mercadopagoEnabled,
      dlocalEnabled,
      dlocalSubscriptionLink: dlocalSubscriptionEnabled ? dlocalSubscriptionLink : '',
      premiumPriceAmount,
      currency,
      contactEmail: data?.contactEmail ?? 'contacto@legalmev.com',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
