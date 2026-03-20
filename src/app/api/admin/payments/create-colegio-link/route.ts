import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9003';
}

/**
 * POST /api/admin/payments/create-colegio-link
 * Genera un link de pago para un colegio (Mercado Pago o DLocal). Solo admins.
 * Body: { colegioId: string, metodo: 'mercadopago' | 'dlocal', periodo?: string }
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
    const adminDb = getAdminDb();

    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const colegioId = typeof body.colegioId === 'string' ? body.colegioId.trim() : '';
    const metodo = body.metodo === 'mercadopago' || body.metodo === 'dlocal' ? body.metodo : null;

    if (!colegioId || !metodo) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere colegioId y metodo (mercadopago | dlocal)' },
        { status: 400 }
      );
    }

    const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
    if (!colegioSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });
    }

    const colegioData = colegioSnap.data();
    const colegioName = colegioData?.name ?? 'Colegio';
    const monto = (colegioData?.montoConvenio != null && colegioData.montoConvenio > 0)
      ? Number(colegioData.montoConvenio)
      : 0;
    const moneda = (colegioData?.moneda as string) ?? 'ARS';

    if (monto <= 0) {
      return NextResponse.json(
        { ok: false, error: 'El colegio no tiene monto configurado. Configurá el monto a cobrar primero.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodo = typeof body.periodo === 'string' && body.periodo.trim()
      ? body.periodo.trim()
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const siteBaseUrl = getBaseUrl();

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
            success: `${siteBaseUrl}/admin?tab=payments`,
            pending: `${siteBaseUrl}/admin?tab=payments`,
            failure: `${siteBaseUrl}/admin?tab=payments`,
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
          { ok: false, error: 'DLocal Go no está configurado.' },
          { status: 503 }
        );
      }

      const orderId = `colegio-${colegioId}-${periodo}-${Date.now()}`;
      const webhookUrl = process.env.DLOCAL_WEBHOOK_URL ?? `${siteBaseUrl}/api/payments/webhook-dlocal`;
      const returnUrl = process.env.DLOCAL_RETURN_URL ?? `${siteBaseUrl}/admin?tab=payments`;

      // Argentina: document debe ser DNI (7-9 dígitos) o CUIT/CUIL (11 dígitos).
      const docRaw = (colegioData?.cuit ?? colegioData?.document) as string | undefined;
      const docClean = docRaw?.replace(/\D/g, '');
      const payerDoc =
        docClean && /^(\d{7,9}|\d{11})$/.test(docClean) ? docClean : '20123456789';

      const dlocalBody = {
        amount: Number(monto),
        currency: moneda,
        country: 'AR',
        payment_method_flow: 'REDIRECT',
        payer: {
          name: colegioName.slice(0, 100),
          email: (colegioData?.contactoFacturacion as string) || 'facturacion@legalmev.com.ar',
          document: payerDoc,
          user_reference: colegioId,
        },
        order_id: orderId,
        notification_url: webhookUrl,
        callback_url: returnUrl,
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
        console.error('[create-colegio-link] DLocal respuesta:', data);
        return NextResponse.json(
          { ok: false, error: data.message ?? data.error ?? 'No se pudo crear el link' },
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
    console.error('[create-colegio-link] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el link';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
