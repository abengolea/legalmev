import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { resolveAudienciaCopilotPrice } from '@/lib/audiencia-copilot-pricing';
import { isAudienciaSessionPaid } from '@/lib/audiencia-copilot-limits';
import { getPaymentsBaseUrl } from '@/lib/payments-base-url';

const SESSIONS = 'audiencia_sessions';

/**
 * POST /api/payments/create-audiencia-copilot-preference
 * Body: { sessionId?: string }
 * - Con sessionId: desbloquea límites de esa audiencia en curso.
 * - Sin sessionId: suma 1 audiencia nueva (cuando consumió la prueba de cuenta).
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

    let body: { sessionId?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : null;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 403 });
    }

    let sessionTitulo = 'Audiencia completa';
    let externalReference: string;

    if (sessionId) {
      const sessionSnap = await adminDb.collection(SESSIONS).doc(sessionId).get();
      if (!sessionSnap.exists || sessionSnap.data()?.userId !== uid) {
        return NextResponse.json({ ok: false, error: 'Audiencia no encontrada' }, { status: 404 });
      }
      if (isAudienciaSessionPaid(sessionSnap.data())) {
        return NextResponse.json(
          { ok: false, error: 'Esta audiencia ya está contratada como completa.' },
          { status: 400 }
        );
      }
      sessionTitulo = (sessionSnap.data()?.titulo as string) || sessionTitulo;
      externalReference = `audiencia-copilot:${uid}:${sessionId}`;
    } else {
      externalReference = `audiencia-copilot-new:${uid}`;
    }

    const paySnap = await adminDb.doc('settings/payments').get();
    const payData = paySnap.exists ? paySnap.data() : {};
    const currency = (payData?.currency as string) ?? 'ARS';
    const { amount, esColegio } = resolveAudienciaCopilotPrice(userData, currency);
    const baseUrl = getPaymentsBaseUrl();

    const userName = (userData.name as string)?.trim();
    const userCuit = String(userData.cuit ?? '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const hubEmit =
      process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ||
      process.env.LEGALMEV_HUB_EMIT_FACTURA === 'true';

    const hubMetadata: Record<string, string> = {
      hub_emit_factura: hubEmit ? 'true' : 'false',
      hub_app_id: 'legalmev',
      hub_concepto: 'Copiloto de Audiencias — audiencia completa',
    };
    if (userCuit.length === 11) hubMetadata.hub_cuit_comprador = userCuit;
    if (userName) hubMetadata.hub_razon_social = userName.slice(0, 100);

    const returnUrl = sessionId
      ? `${baseUrl}/dashboard/copiloto-audiencias?mp=success&sessionId=${encodeURIComponent(sessionId)}`
      : `${baseUrl}/dashboard/copiloto-audiencias?mp=success`;

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: sessionId ? `audiencia-copilot-${sessionId}` : 'audiencia-copilot-nueva',
            title: 'Copiloto de Audiencias — audiencia completa',
            description: sessionId
              ? `Sin límites de prueba · ${sessionTitulo}`
              : 'Una audiencia nueva sin límites de la prueba gratuita',
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        payer: { email: email || undefined },
        metadata: {
          ...hubMetadata,
          legalmev_product: 'audiencia_copilot',
          legalmev_session_id: sessionId ?? '',
          legalmev_colegio_price: esColegio ? 'true' : 'false',
        },
        external_reference: externalReference,
        back_urls: {
          success: returnUrl,
          pending: `${returnUrl}&mp=pending`,
          failure: `${baseUrl}/dashboard/copiloto-audiencias?mp=failure${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`,
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

    return NextResponse.json({
      ok: true,
      initPoint,
      amount,
      currency,
      esColegio,
    });
  } catch (err) {
    console.error('[create-audiencia-copilot-preference] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el pago';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
