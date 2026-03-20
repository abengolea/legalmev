import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_DOC = 'settings/payments';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9003';
}

/**
 * POST /api/payments/create-dlocal-order
 * Crea un pago en DLocal Go (Notificas SRL) para el plan premium.
 * Usa API_KEY y SECRET_KEY con Bearer API_KEY:SECRET_KEY
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DLOCAL_API_KEY;
    const secretKey = process.env.DLOCAL_SECRET_KEY;
    const baseUrl = process.env.DLOCAL_BASE_URL ?? 'https://api.dlocalgo.com';

    if (!apiKey?.trim() || !secretKey?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'DLocal Go no está configurado. Contactá al administrador.' },
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
    const siteBaseUrl = getBaseUrl();
    const webhookUrl = process.env.DLOCAL_WEBHOOK_URL ?? `${siteBaseUrl}/api/payments/webhook-dlocal`;
    const returnUrl = process.env.DLOCAL_RETURN_URL ?? `${siteBaseUrl}/dashboard?dlocal=success`;

    const orderId = `premium-${uid}-${Date.now()}`;
    // dLocal requiere payer pero enviamos vacío para que el usuario complete los datos en el checkout.
    const amountNum = Math.round(Number(amount));
    const body = {
      amount: amountNum,
      currency,
      country: 'AR',
      payment_method_id: 'CARD',
      payment_method_flow: 'REDIRECT',
      description: 'Suscripción Premium LegalMev',
      payer: {
        name: '',
        email: '',
        document: '',
        document_type: 'DNI',
        user_reference: uid,
      },
      order_id: orderId,
      notification_url: webhookUrl,
      callback_url: returnUrl,
    };

    const apiBase = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${apiBase}/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}:${secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LegalMev/1.0',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const redirectUrl = data.redirect_url ?? data.redirect_link ?? data.payment_url;
    const dlocalError = data.message ?? data.error ?? '';

    if (!redirectUrl) {
      // Log payload (sin credenciales) para debug con dLocal cuando code 5000
      if (data.code === 5000) {
        console.error('[create-dlocal-order] code 5000 - Payload enviado:', JSON.stringify(body));
      }
      console.error('[create-dlocal-order] Respuesta:', data);
      const errorMsg = dlocalError || 'No se pudo crear el pago';
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: res.ok ? 500 : res.status }
      );
    }

    return NextResponse.json({ ok: true, redirectUrl });
  } catch (err) {
    console.error('[create-dlocal-order] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el pago';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
