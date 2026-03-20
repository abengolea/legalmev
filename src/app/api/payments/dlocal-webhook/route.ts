import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/payments/dlocal-webhook
 * Webhook IPN de DLocal. Cuando el pago está PAID:
 * - premium-{uid}-{timestamp}: actualiza usuario a premium
 * - colegio-{id}-{periodo}-{timestamp}: registra pago colegio
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const status = body.status as string | undefined;
    const orderId = body.order_id as string | undefined;

    if (status !== 'PAID' || !orderId) {
      return NextResponse.json({ ok: true });
    }

    const adminDb = getAdminDb();
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
        console.log('[dlocal-webhook] Pago colegio registrado:', colegioId, periodo);
      }
      return NextResponse.json({ ok: true });
    }

    if (!orderId.startsWith('premium-')) {
      return NextResponse.json({ ok: true });
    }

    const parts = orderId.split('-');
    const uid = parts[1];
    if (!uid) return NextResponse.json({ ok: true });

    const userRef = adminDb.collection('users').doc(uid);
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
      console.log('[dlocal-webhook] Usuario', uid, 'actualizado a premium (order:', orderId, ')');
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[dlocal-webhook] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
