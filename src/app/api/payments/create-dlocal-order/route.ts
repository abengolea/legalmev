import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { dlocalLog } from '@/lib/dlocal-log';

const SETTINGS_DOC = 'settings/payments';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
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
      dlocalLog.configMissing('create-dlocal-order: DLOCAL_API_KEY o DLOCAL_SECRET_KEY vacíos');
      const isDev = process.env.NODE_ENV === 'development';
      const hint = isDev
        ? ' Agregá DLOCAL_API_KEY y DLOCAL_SECRET_KEY en .env.local (raíz del proyecto) y reiniciá con npm run dev.'
        : ' Contactá al administrador.';
      return NextResponse.json(
        { ok: false, error: `DLocal Go no está configurado.${hint}` },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      dlocalLog.createOrderError(new Error('No autenticado'));
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      dlocalLog.createOrderError(new Error('Usuario no encontrado'), uid);
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 403 });
    }
    if (userData.tier === 'premium') {
      dlocalLog.createOrderReject('Usuario ya premium', uid);
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
    dlocalLog.createOrderStart(uid, orderId, webhookUrl);
    // DLocal exige name, email y document no vacíos (invalid values si son '').
    const userName = ((userData.name ?? userData.displayName) as string)?.trim() || 'Cliente';
    const userEmail = (userData.email as string)?.trim() || '';
    if (!userEmail) {
      dlocalLog.createOrderError(new Error('Usuario sin email'), uid);
      return NextResponse.json(
        { ok: false, error: 'Tu cuenta no tiene email. Actualizá tu perfil para poder pagar.' },
        { status: 400 }
      );
    }
    const docRaw = (userData.document ?? userData.dni ?? userData.cuit) as string | undefined;
    const docClean = docRaw?.replace(/\D/g, '');
    const payerDoc = docClean && /^(\d{7,9}|\d{11})$/.test(docClean) ? docClean : '20123456789';

    const amountNum = Math.round(Number(amount));
    const body = {
      amount: amountNum,
      currency,
      country: 'AR',
      payment_method_id: 'CARD',
      payment_method_flow: 'REDIRECT',
      description: 'Suscripción Premium LegalMev',
      payer: {
        name: userName.slice(0, 100),
        email: userEmail.slice(0, 100),
        document: payerDoc,
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
      dlocalLog.createOrderNoRedirect(orderId, res.status, data);
      const errorMsg = dlocalError || 'No se pudo crear el pago';
      // "Invalid credentials" = credenciales sandbox con URL live (o viceversa)
      const hint = /invalid credential/i.test(errorMsg)
        ? ' Verificá que DLOCAL_BASE_URL coincida con tus credenciales: api-sbx.dlocalgo.com para sandbox, api.dlocalgo.com para live.'
        : '';
      return NextResponse.json(
        { ok: false, error: errorMsg + hint },
        { status: res.ok ? 500 : res.status }
      );
    }

    dlocalLog.createOrderOk(orderId, uid);
    return NextResponse.json({ ok: true, redirectUrl });
  } catch (err) {
    dlocalLog.createOrderError(err);
    const msg = err instanceof Error ? err.message : 'Error al crear el pago';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
