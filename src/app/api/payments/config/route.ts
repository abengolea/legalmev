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

    const adminDb = getAdminDb();
    const docSnap = await adminDb.doc(SETTINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : {};

    const mercadopagoPublicKey = data?.mercadopagoPublicKey ?? '';
    const mercadopagoEnabled = !!(mercadopagoPublicKey?.trim() && accessToken?.trim());
    const premiumPriceAmount = (data?.premiumPriceAmount && data.premiumPriceAmount > 0)
      ? data.premiumPriceAmount
      : 0;
    const currency = data?.currency ?? 'ARS';

    return NextResponse.json({
      ok: true,
      mercadopagoEnabled,
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
