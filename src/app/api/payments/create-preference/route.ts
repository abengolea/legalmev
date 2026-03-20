import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_DOC = 'settings/payments';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9003';
}

/**
 * POST /api/payments/create-preference
 * Crea una preferencia de Mercado Pago Checkout Pro para el plan premium.
 * Requiere autenticación. Devuelve init_point para redirigir al usuario.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Mercado Pago no está configurado. Contactá al administrador.' },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email ?? '';

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 403 });
    }
    if (userData.tier === 'premium') {
      return NextResponse.json({ ok: false, error: 'Ya tenés el plan premium' }, { status: 400 });
    }

    const paySnap = await adminDb.doc(SETTINGS_DOC).get();
    const payData = paySnap.exists ? paySnap.data() : {};
    const amount = (payData?.premiumPriceAmount && payData.premiumPriceAmount > 0)
      ? payData.premiumPriceAmount
      : 9999;
    const currency = payData?.currency ?? 'ARS';
    const baseUrl = getBaseUrl();

    const client = new MercadoPagoConfig({
      accessToken,
    });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'premium-legalmev',
            title: 'Plan Premium LegalMev',
            description: 'Exportaciones ilimitadas de expedientes por mes',
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        payer: {
          email: email || undefined,
        },
        external_reference: uid,
        back_urls: {
          success: `${baseUrl}/dashboard?mp=success`,
          pending: `${baseUrl}/dashboard?mp=pending`,
          failure: `${baseUrl}/dashboard?mp=failure`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/payments/mercadopago-webhook?source_news=webhooks`,
      },
    });

    const initPoint = result.init_point ?? result.sandbox_init_point;
    if (!initPoint) {
      return NextResponse.json(
        { ok: false, error: 'No se pudo crear el link de pago' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, initPoint });
  } catch (err) {
    console.error('[create-preference] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el pago';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
