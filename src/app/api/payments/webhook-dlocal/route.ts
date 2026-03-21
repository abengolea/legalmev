import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPaymentSuccessEmail, sendPaymentRejectedEmail } from '@/lib/payment-notifications';
import { dlocalLog } from '@/lib/dlocal-log';

/** Extrae uid para pago premium (one-time o suscripción) */
function getPremiumUid(
  body: { order_id?: string; payer?: { user_reference?: string } }
): string | undefined {
  const orderId = body.order_id;
  if (orderId?.startsWith('premium-')) {
    return orderId.split('-')[1];
  }
  return body.payer?.user_reference?.trim();
}

/**
 * POST /api/payments/webhook-dlocal
 * Webhook IPN de DLocal Go.
 * PAID: actualiza premium, registra pago, envía email de cobro exitoso.
 * REJECTED/FAILED: envía email de pago rechazado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const status = (body.status as string)?.toUpperCase();
    const orderId = body.order_id as string | undefined;

    dlocalLog.webhookReceived(status ?? 'unknown', orderId);

    const adminDb = getAdminDb();

    // REJECTED, FAILED, CANCELLED: un solo aviso, guardar timestamp. En 10 días → free sin descargas.
    if (['REJECTED', 'FAILED', 'CANCELLED', 'CANCELED'].includes(status ?? '')) {
      const uid = getPremiumUid(body);
      if (uid) {
        const userRef = adminDb.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();
        const isPaymentSubscriber = userData?.tier === 'premium' && userData?.premiumSource === 'payment';
        if (isPaymentSubscriber) {
          const now = new Date().toISOString();
          const updates: Record<string, unknown> = {};
          if (!userData?.paymentRejectedAt) {
            updates.paymentRejectedAt = now;
          }
          if (!userData?.paymentRejectedWarningSentAt) {
            const email = (userData?.email as string) || '';
            if (email) {
              await sendPaymentRejectedEmail({
                to: email,
                userName: (userData?.name as string) || undefined,
              });
              updates.paymentRejectedWarningSentAt = now;
            }
          }
          if (Object.keys(updates).length > 0) {
            await userRef.update(updates);
          }
        }
      }
      dlocalLog.webhookRejected(orderId ?? 'unknown', status ?? '', getPremiumUid(body));
      return NextResponse.json({ ok: true });
    }

    if (status !== 'PAID' || !orderId) {
      dlocalLog.webhookIgnored(
        status !== 'PAID' ? `status=${status}` : 'sin order_id',
        orderId
      );
      return NextResponse.json({ ok: true });
    }

    const { recordPayment } = await import('@/lib/payments');

    if (orderId.startsWith('colegio-')) {
      const parts = orderId.split('-');
      const colegioId = parts[1];
      const periodoParts = parts.slice(2, -1);
      const periodo = periodoParts.length ? periodoParts.join('-') : undefined;
      const amount = (body.amount as number) ?? 0;
      const currency = (body.currency as string) ?? 'ARS';
      if (colegioId) {
        const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
        const colegioName = colegioSnap.exists ? (colegioSnap.data()?.name as string) : undefined;
        await recordPayment(adminDb, {
          tipo: 'colegio',
          colegioId,
          colegioName,
          monto: amount,
          moneda: currency,
          metodo: 'dlocal',
          referenciaExterna: orderId,
          estado: 'completado',
          descripcion: `Cuota convenio - Período ${periodo ?? 'N/A'}`,
          periodo,
        });
        dlocalLog.webhookColegioPaid(colegioId, periodo);
      }
      return NextResponse.json({ ok: true });
    }

    const uid = getPremiumUid(body);
    if (!uid) return NextResponse.json({ ok: true });

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const isNewPremium = userSnap.exists && userData?.tier !== 'premium';
    if (isNewPremium) {
      await userRef.update({
        tier: 'premium',
        premiumSource: 'payment',
        downloadsThisMonth: 0,
        monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        premiumActivatedAt: new Date().toISOString(),
        paymentRejectedAt: FieldValue.delete(),
        paymentRejectedWarningSentAt: FieldValue.delete(),
        subscriptionLapsed: FieldValue.delete(),
      });
      dlocalLog.webhookPremiumActivated(orderId, uid);
    } else if (userSnap.exists && userData?.tier === 'premium' && (userData?.paymentRejectedAt || userData?.paymentRejectedWarningSentAt || userData?.subscriptionLapsed)) {
      await userRef.update({
        paymentRejectedAt: FieldValue.delete(),
        paymentRejectedWarningSentAt: FieldValue.delete(),
        subscriptionLapsed: FieldValue.delete(),
      });
    }
    const paySnap = await adminDb.doc('settings/payments').get();
    const payData = paySnap.exists ? paySnap.data() : {};
    const amount = (payData?.premiumPriceAmount && payData.premiumPriceAmount > 0) ? payData.premiumPriceAmount : 9999;
    await recordPayment(adminDb, {
      tipo: 'cliente',
      clienteId: uid,
      monto: amount,
      moneda: payData?.currency ?? 'ARS',
      metodo: 'dlocal',
      referenciaExterna: orderId,
      estado: 'completado',
      descripcion: 'Plan Premium LegalMev',
    });

    // Notificar cobro exitoso por email (suscripción recurrente o primer pago)
    const userEmail = (userData?.email as string) || '';
    if (userEmail) {
      const amountFromBody = (body.amount as number) ?? amount;
      await sendPaymentSuccessEmail({
        to: userEmail,
        userName: (userData?.name as string) || undefined,
        amount: amountFromBody > 0 ? amountFromBody : amount,
        currency: (body.currency as string) ?? payData?.currency ?? 'ARS',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    dlocalLog.webhookError(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
