import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPaymentSuccessEmail } from '@/lib/payment-notifications';
import { requestHubInvoiceForLegalMevPayment } from '@/lib/hub-billing';
import { recordPayment } from '@/lib/payments';
import { AUDIENCIA_COPILOT_TRIAL_SESSIONS } from '@/lib/audiencia-copilot-access';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Extrae topic/type e id del pago desde GET (IPN) o POST (Webhooks).
 * - IPN: GET ?topic=payment&id=xxx
 * - Webhooks: POST con JSON { type: "payment", data: { id: "xxx" } } o query ?data.id=xxx
 */
function parseNotification(request: NextRequest): { topic: string; id: string } | null {
  const { searchParams } = new URL(request.url);

  const topicGet = searchParams.get('topic');
  const idGet = searchParams.get('id');
  if (topicGet && idGet) return { topic: topicGet, id: idGet };

  const dataId = searchParams.get('data.id');
  if (dataId) return { topic: 'payment', id: dataId };

  return null;
}

function buyerFromUser(userData: Record<string, unknown> | undefined, payerEmail?: string) {
  const name = (userData?.name as string)?.trim();
  return {
    email: payerEmail || (userData?.email as string) || undefined,
    razonSocial: name || undefined,
    cuit: (userData?.cuit as string) || undefined,
  };
}

function buyerFromColegio(colegioData: Record<string, unknown> | undefined) {
  const name = (colegioData?.name as string)?.trim();
  return {
    email: (colegioData?.contactoFacturacion as string) || undefined,
    razonSocial: name || undefined,
    cuit: ((colegioData?.cuit ?? colegioData?.document) as string) || undefined,
  };
}

async function emitHubInvoice(opts: {
  paymentId: string;
  amount: number;
  externalRef: string;
  preferenceId?: string;
  payerEmail?: string;
  buyer: { email?: string; razonSocial?: string; cuit?: string };
  description: string;
  pagoDocId: string;
  metadata?: Record<string, unknown>;
}) {
  const adminDb = getAdminDb();
  const billing = await requestHubInvoiceForLegalMevPayment(adminDb, {
    paymentId: opts.paymentId,
    amount: opts.amount,
    externalReference: opts.externalRef,
    preferenceId: opts.preferenceId,
    buyer: opts.buyer,
    item: { description: opts.description },
    pagoDocId: opts.pagoDocId,
    metadata: opts.metadata,
  });

  if (billing.ok) {
    console.log('[mercadopago-webhook] Factura Hub emitida/registrada', {
      paymentId: opts.paymentId,
      facturaId: billing.facturaId,
      alreadyIssued: billing.alreadyIssued,
    });
  } else if (billing.skipped) {
    console.warn('[mercadopago-webhook] Facturación Hub omitida', {
      paymentId: opts.paymentId,
      reason: billing.reason,
    });
  } else {
    console.error('[mercadopago-webhook] Facturación Hub falló', {
      paymentId: opts.paymentId,
      error: billing.error,
      status: billing.status,
    });
  }
}

async function processAudienciaCopilotPayment(opts: {
  adminDb: Firestore;
  uid: string;
  sessionId: string | null;
  amount: number;
  moneda: string;
  paymentId: string;
  preferenceId?: string;
  payerEmail?: string;
  userData: Record<string, unknown> | undefined;
}): Promise<void> {
  const { adminDb, uid, sessionId, amount, moneda, paymentId, preferenceId, payerEmail, userData } =
    opts;
  const now = new Date().toISOString();

  if (sessionId) {
    const sessionRef = adminDb.collection('audiencia_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (sessionSnap.exists && sessionSnap.data()?.userId === uid) {
      await sessionRef.set(
        {
          audienciaPagada: true,
          audienciaPagoMeta: {
            paymentId: String(paymentId),
            monto: amount,
            moneda,
            paidAt: now,
          },
          updatedAt: now,
        },
        { merge: true }
      );
      console.log('[mercadopago-webhook] Audiencia copilot desbloqueada:', sessionId);
    }
  } else {
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const trial = userSnap.data()?.audienciaCopilotTrial as
      | { limit?: number; used?: number; grantedAt?: string }
      | undefined;
    const currentLimit =
      typeof trial?.limit === 'number' && trial.limit > 0
        ? trial.limit
        : AUDIENCIA_COPILOT_TRIAL_SESSIONS;
    const used = typeof trial?.used === 'number' ? trial.used : 0;
    await userRef.set(
      {
        audienciaCopilotTrial: {
          limit: currentLimit + 1,
          used,
          grantedAt: trial?.grantedAt ?? now,
          grantedBy: 'payment',
        },
        updatedAt: now,
      },
      { merge: true }
    );
    console.log('[mercadopago-webhook] Audiencia copilot: +1 audiencia para usuario', uid);
  }

  const sessionTitulo = sessionId
    ? (
        await adminDb.collection('audiencia_sessions').doc(sessionId).get()
      ).data()?.titulo
    : undefined;

  const descripcion = sessionId
    ? `Copiloto Audiencias — ${(sessionTitulo as string) || 'audiencia completa'}`
    : 'Copiloto Audiencias — audiencia completa (nueva)';

  const pagoDocId = await recordPayment(adminDb, {
    tipo: 'cliente',
    clienteId: uid,
    monto: amount,
    moneda,
    metodo: 'mercadopago',
    referenciaExterna: String(paymentId),
    estado: 'completado',
    descripcion,
  });

  const userEmail = (userData?.email as string) || '';
  if (userEmail) {
    await sendPaymentSuccessEmail({
      to: userEmail,
      userName: (userData?.name as string) || undefined,
      amount,
      currency: moneda,
    });
  }

  await emitHubInvoice({
    paymentId: String(paymentId),
    amount,
    externalRef: sessionId ? `audiencia-copilot:${uid}:${sessionId}` : `audiencia-copilot-new:${uid}`,
    preferenceId,
    payerEmail,
    buyer: buyerFromUser(userData, payerEmail),
    description: descripcion,
    pagoDocId,
    metadata: {
      tipo: 'audiencia_copilot',
      clienteId: uid,
      audienciaSessionId: sessionId ?? undefined,
    },
  });
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
    const amount = (payInfo.transaction_amount as number) ?? 0;
    const moneda = (payInfo.currency_id as string) ?? 'ARS';
    const payerEmail = (payInfo.payer as { email?: string } | undefined)?.email;
    const preferenceId = (payInfo as { preference_id?: string }).preference_id;

    if (externalRef.startsWith('audiencia-copilot:')) {
      const parts = externalRef.split(':');
      const uid = parts[1];
      const sessionId = parts[2] || null;
      if (uid) {
        const userSnap = await adminDb.collection('users').doc(uid).get();
        await processAudienciaCopilotPayment({
          adminDb,
          uid,
          sessionId,
          amount,
          moneda,
          paymentId: String(id),
          preferenceId,
          payerEmail,
          userData: userSnap.data(),
        });
      }
      return { ok: true };
    }

    if (externalRef.startsWith('audiencia-copilot-new:')) {
      const uid = externalRef.slice('audiencia-copilot-new:'.length);
      if (uid) {
        const userSnap = await adminDb.collection('users').doc(uid).get();
        await processAudienciaCopilotPayment({
          adminDb,
          uid,
          sessionId: null,
          amount,
          moneda,
          paymentId: String(id),
          preferenceId,
          payerEmail,
          userData: userSnap.data(),
        });
      }
      return { ok: true };
    }

    if (externalRef.startsWith('colegio-')) {
      const parts = externalRef.split('-');
      const colegioId = parts[1];
      const periodo = parts.slice(2).join('-') || undefined;
      if (colegioId) {
        const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
        const colegioData = colegioSnap.data() as Record<string, unknown> | undefined;
        const colegioName = colegioSnap.exists ? (colegioData?.name as string) : undefined;
        const pagoDocId = await recordPayment(adminDb, {
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

        const desc = `Cuota convenio LegalMev${colegioName ? ` - ${colegioName}` : ''}${periodo ? ` (${periodo})` : ''}`;
        await emitHubInvoice({
          paymentId: String(id),
          amount,
          externalRef,
          preferenceId,
          payerEmail,
          buyer: buyerFromColegio(colegioData),
          description: desc,
          pagoDocId,
          metadata: { tipo: 'colegio', colegioId, periodo },
        });
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
      const pagoDocId = await recordPayment(adminDb, {
        tipo: 'cliente',
        clienteId: externalRef,
        monto: amount,
        moneda,
        metodo: 'mercadopago',
        referenciaExterna: String(id),
        estado: 'completado',
        descripcion: 'Plan Premium LegalMev',
      });

      const userEmail = (userData?.email as string) || '';
      if (userEmail) {
        await sendPaymentSuccessEmail({
          to: userEmail,
          userName: (userData?.name as string) || undefined,
          amount,
          currency: moneda,
        });
      }

      await emitHubInvoice({
        paymentId: String(id),
        amount,
        externalRef,
        preferenceId,
        payerEmail,
        buyer: buyerFromUser(userData, payerEmail),
        description: 'Plan Premium LegalMev',
        pagoDocId,
        metadata: { tipo: 'cliente', clienteId: externalRef },
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

  if (!parsed && request.method === 'POST') {
    try {
      const body = await request.json();
      const type = (body?.type ?? body?.topic) as string | undefined;
      const dataId = body?.data?.id ?? body?.id;
      if (type === 'payment' && dataId) {
        parsed = { topic: 'payment', id: String(dataId) };
      }
    } catch {
      // body no es JSON válido
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

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (err) {
    console.error('[mercadopago-webhook] Error GET:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleNotification(request);
  } catch (err) {
    console.error('[mercadopago-webhook] Error POST:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
