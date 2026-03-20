import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Extrae topic/type e id del pago desde GET (IPN) o POST (Webhooks).
 * - IPN: GET ?topic=payment&id=xxx
 * - Webhooks: POST con JSON { type: "payment", data: { id: "xxx" } } o query ?data.id=xxx
 */
function parseNotification(request: NextRequest): { topic: string; id: string } | null {
  const { searchParams } = new URL(request.url);

  // Formato IPN: ?topic=payment&id=xxx
  const topicGet = searchParams.get('topic');
  const idGet = searchParams.get('id');
  if (topicGet && idGet) return { topic: topicGet, id: idGet };

  // Formato Webhooks en query: ?data.id=xxx (type puede venir en body)
  const dataId = searchParams.get('data.id');
  if (dataId) return { topic: 'payment', id: dataId };

  return null;
}

async function processPaymentNotification(accessToken: string, id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const payInfo = await payment.get({ id });
    const status = payInfo.status as string | undefined;
    const externalRef = payInfo.external_reference as string | undefined;

    if (status !== 'approved' || !externalRef) {
      console.log('[mercadopago-webhook] Pago', id, 'status:', status, 'external_ref:', externalRef ?? '(vacío)');
      return { ok: true };
    }

    const adminDb = getAdminDb();
    const { recordPayment } = await import('@/lib/payments');
    const amount = (payInfo.transaction_amount as number) ?? 0;
    const moneda = (payInfo.currency_id as string) ?? 'ARS';

    if (externalRef.startsWith('colegio-')) {
    const parts = externalRef.split('-');
    const colegioId = parts[1];
    const periodo = parts.slice(2).join('-') || undefined;
    if (colegioId) {
      const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
      const colegioName = colegioSnap.exists ? (colegioSnap.data()?.name as string) : undefined;
      await recordPayment(adminDb, {
        tipo: 'colegio',
        colegioId,
        colegioName,
        monto: amount,
        moneda,
        metodo: 'mercadopago',
        referenciaExterna: String(id),
        estado: 'completado',
        descripcion: `Cuota convenio - Período ${periodo ?? 'N/A'}`,
        periodo,
      });
      console.log('[mercadopago-webhook] Pago colegio registrado:', colegioId, periodo);
    }
  } else {
    const userRef = adminDb.collection('users').doc(externalRef);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    if (userSnap.exists && userData?.tier !== 'premium') {
      await userRef.update({
        tier: 'premium',
        premiumSource: 'payment',
        downloadsThisMonth: 0,
        monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        premiumActivatedAt: new Date().toISOString(),
      });
      console.log('[mercadopago-webhook] Usuario', externalRef, 'actualizado a premium');
    }
    await recordPayment(adminDb, {
      tipo: 'cliente',
      clienteId: externalRef,
      monto: amount,
      moneda,
      metodo: 'mercadopago',
      referenciaExterna: String(id),
      estado: 'completado',
      descripcion: 'Plan Premium LegalMev',
    });
  }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[mercadopago-webhook] Error procesando pago', id, ':', msg, stack);
    return { ok: false, error: msg };
  }
}

async function handleNotification(request: NextRequest): Promise<NextResponse> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken?.trim()) {
    return NextResponse.json({ error: 'No configurado' }, { status: 503 });
  }

  let parsed = parseNotification(request);

  // POST: intentar leer body JSON (Webhooks envían { type, data: { id } })
  if (!parsed && request.method === 'POST') {
    try {
      const body = await request.json();
      const type = (body?.type ?? body?.topic) as string | undefined;
      const dataId = body?.data?.id ?? body?.id;
      if (type === 'payment' && dataId) {
        parsed = { topic: 'payment', id: String(dataId) };
      }
    } catch {
      // body no es JSON válido, ignorar
    }
  }

  if (!parsed) {
    return NextResponse.json({ error: 'Faltan topic/type e id' }, { status: 400 });
  }

  if (parsed.topic === 'payment') {
    const result = await processPaymentNotification(accessToken, parsed.id);
    if (!result.ok) {
      console.error('[mercadopago-webhook] No se pudo procesar:', result.error);
    }
  }

  // Siempre 200 para que Mercado Pago no reintente indefinidamente
  return NextResponse.json({ ok: true });
}

/**
 * GET: IPN legacy envía ?topic=payment&id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (err) {
    console.error('[mercadopago-webhook] Error GET:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST: Webhooks e IPN moderno envían JSON o form.
 * Mercado Pago recomienda Webhooks (POST) sobre IPN.
 */
export async function POST(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (err) {
    console.error('[mercadopago-webhook] Error POST:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
