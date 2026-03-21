import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
}

/**
 * POST /api/colegio/create-payment-link
 * Genera link de pago para el colegio que el usuario administra.
 * Solo responsables (email en adminEmails). Monto definido por superadmin en montoConvenio.
 * Body: { metodo: 'mercadopago' | 'dlocal', periodo?: string }
 */
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Sin email' }, { status: 400 });
    }

    const body = await request.json();
    const metodo = body.metodo === 'mercadopago' || body.metodo === 'dlocal' ? body.metodo : null;
    if (!metodo) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere metodo (mercadopago | dlocal)' },
        { status: 400 }
      );
    }

    const colegiosSnap = await adminDb
      .collection('colegios')
      .where('adminEmails', 'array-contains', email)
      .limit(1)
      .get();

    if (colegiosSnap.empty) {
      return NextResponse.json({ ok: false, error: 'No administrás ningún colegio' }, { status: 403 });
    }

    const colegioDoc = colegiosSnap.docs[0];
    const colegioId = colegioDoc.id;
    const colegioData = colegioDoc.data();
    const colegioName = (colegioData?.name as string) ?? 'Colegio';
    const monto = (colegioData?.montoConvenio != null && colegioData.montoConvenio > 0)
      ? Number(colegioData.montoConvenio)
      : 0;
    const moneda = (colegioData?.moneda as string) ?? 'ARS';

    if (monto <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Tu colegio aún no tiene monto de suscripción configurado. Contactá al administrador de LegalMev.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodo = typeof body.periodo === 'string' && body.periodo.trim()
      ? body.periodo.trim()
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const siteBaseUrl = getBaseUrl();
    const returnBase = `${siteBaseUrl}/dashboard/colegio`;

    if (metodo === 'mercadopago') {
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken?.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Mercado Pago no está configurado.' },
          { status: 503 }
        );
      }

      const externalRef = `colegio-${colegioId}-${periodo}`;
      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      const result = await preference.create({
        body: {
          items: [
            {
              id: `convenio-${colegioId}`,
              title: `Cuota convenio - ${colegioName}`,
              description: `Pago convenio LegalMev - Período ${periodo}`,
              quantity: 1,
              unit_price: monto,
              currency_id: moneda,
            },
          ],
          external_reference: externalRef,
          back_urls: {
            success: returnBase,
            pending: returnBase,
            failure: returnBase,
          },
          auto_return: 'approved',
          notification_url: `${siteBaseUrl}/api/payments/mercadopago-webhook?source_news=webhooks`,
        },
      });

      const initPoint = result.init_point ?? result.sandbox_init_point;
      if (!initPoint) {
        return NextResponse.json(
          { ok: false, error: 'No se pudo crear el link de pago' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        link: initPoint,
        metodo: 'mercadopago',
        colegioName,
        periodo,
        monto,
        moneda,
      });
    }

    if (metodo === 'dlocal') {
      const apiKey = process.env.DLOCAL_API_KEY;
      const secretKey = process.env.DLOCAL_SECRET_KEY;
      const dlocalBaseUrl = process.env.DLOCAL_BASE_URL ?? 'https://api.dlocalgo.com';

      if (!apiKey?.trim() || !secretKey?.trim()) {
        return NextResponse.json(
          { ok: false, error: 'DLocal no está configurado.' },
          { status: 503 }
        );
      }

      const orderId = `colegio-${colegioId}-${periodo}-${Date.now()}`;
      const webhookUrl = process.env.DLOCAL_WEBHOOK_URL ?? `${siteBaseUrl}/api/payments/webhook-dlocal`;
      const payerEmail = (colegioData?.contactoFacturacion as string) || email || 'facturacion@legalmev.com.ar';
      const docRaw = (colegioData?.cuit ?? colegioData?.document) as string | undefined;
      const docClean = docRaw?.replace(/\D/g, '');
      const payerDoc = docClean && /^(\d{7,9}|\d{11})$/.test(docClean) ? docClean : '20123456789';

      const dlocalBody = {
        amount: Number(monto),
        currency: moneda,
        country: 'AR',
        payment_method_flow: 'REDIRECT',
        payer: {
          name: (userData.name as string) || colegioName.slice(0, 100),
          email: payerEmail,
          document: payerDoc,
          user_reference: colegioId,
        },
        order_id: orderId,
        notification_url: webhookUrl,
        callback_url: returnBase,
      };

      const apiBase = dlocalBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${apiBase}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}:${secretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LegalMev/1.0',
        },
        body: JSON.stringify(dlocalBody),
      });

      const data = await res.json();
      const redirectUrl = data.redirect_url ?? data.redirect_link ?? data.payment_url;

      if (!redirectUrl) {
        console.error('[colegio create-payment-link] DLocal:', data);
        const errMsg = data.message ?? data.error ?? 'No se pudo crear el link';
        const hint = /invalid credential/i.test(String(errMsg))
          ? ' Verificá que DLOCAL_BASE_URL coincida con tus credenciales: api-sbx.dlocalgo.com para sandbox, api.dlocalgo.com para live.'
          : '';
        return NextResponse.json(
          { ok: false, error: errMsg + hint },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        link: redirectUrl,
        metodo: 'dlocal',
        colegioName,
        periodo,
        monto,
        moneda,
      });
    }

    return NextResponse.json({ ok: false, error: 'Método no válido' }, { status: 400 });
  } catch (err) {
    console.error('[colegio create-payment-link]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
