import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://www.legalmev.com.ar';
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
}

/**
 * POST /api/admin/payments/create-colegio-link
 * Genera un link de pago Mercado Pago para un colegio. Solo admins.
 * Body: { colegioId: string, periodo?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

    const body = await request.json();
    const colegioId = typeof body.colegioId === 'string' ? body.colegioId.trim() : '';

    if (!colegioId) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere colegioId' },
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
    if (colegioName) hubMetadata.hub_razon_social = String(colegioName).slice(0, 100);

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
        metadata: hubMetadata,
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
  } catch (err) {
    console.error('[create-colegio-link] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el link';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
