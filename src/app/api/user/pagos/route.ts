import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';

/**
 * GET /api/user/pagos
 * Historial de pagos del usuario autenticado (plan premium).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const snap = await adminDb
    .collection('pagos')
    .where('clienteId', '==', auth.uid)
    .limit(80)
    .get();

  const pagos = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        createdAt: (data.createdAt as string) ?? '',
        descripcion: (data.descripcion as string) ?? '',
        monto: Number(data.monto) || 0,
        moneda: (data.moneda as string) ?? 'ARS',
        estado: (data.estado as string) ?? '',
        metodo: (data.metodo as string) ?? '',
        referenciaExterna: (data.referenciaExterna as string) ?? undefined,
        billingHub: data.billingHub ?? null,
      };
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return NextResponse.json({ ok: true, pagos });
}
