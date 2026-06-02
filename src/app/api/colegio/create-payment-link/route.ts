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
 * Body: { periodo?: string } — solo Mercado Pago
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
    const payerEmail = (decoded.email ?? '').toString().toLowerCase();

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
    if (colegioData?.convenioActivo === false) {
      return NextResponse.json(
        { ok: false, error: 'El convenio está suspendido. Contactá al administrador de LegalMev.' },
        { status: 400 }
      );
    }
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

    const externalRef = `colegio-${colegioId}-${periodo}`;
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);
    const hubEmit =
      process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ||
      process.env.LEGALMEV_HUB_EMIT_FACTURA === 'true';
    const cuitDigits = String(colegioData?.cuit ?? colegioData?.document ?? '').replace(/\D/g, '').slice(0, 11);
    const hubMetadata: Record<string, string> = {
      hub_emit_factura: hubEmit ? 'true' : 'false',
      hub_app_id: 'legalmev',
      hub_concepto: `Cuota convenio LegalMev - ${colegioName}`,
    };
    if (cuitDigits.length === 11) hubMetadata.hub_cuit_comprador = cuitDigits;
    if (colegioName) hubMetadata.hub_razon_social = colegioName.slice(0, 100);

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
        payer: {
          email: payerEmail || email || undefined,
        },
        metadata: hubMetadata,
        external_reference: externalRef,
        back_urls: {
          success: `${siteBaseUrl}/dashboard/pagos?mp=success`,
          pending: `${siteBaseUrl}/dashboard/pagos?mp=pending`,
          failure: `${siteBaseUrl}/dashboard/pagos?mp=failure`,
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
      initPoint,
      link: initPoint,
      metodo: 'mercadopago',
      colegioName,
      periodo,
      monto,
      moneda,
    });
  } catch (err) {
    console.error('[colegio create-payment-link]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
