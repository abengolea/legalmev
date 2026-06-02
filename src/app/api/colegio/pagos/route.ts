import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * GET /api/colegio/pagos?colegioId=...
 * Historial de cuotas pagadas de un colegio. Solo superadmin LegalMev.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const colegioId = new URL(request.url).searchParams.get('colegioId')?.trim();
  if (!colegioId) {
    return NextResponse.json({ ok: false, error: 'Se requiere colegioId' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
  if (!colegioSnap.exists) {
    return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });
  }

  const colegioName = (colegioSnap.data()?.name as string) ?? 'Colegio';

  const snap = await adminDb
    .collection('pagos')
    .where('colegioId', '==', colegioId)
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
        periodo: (data.periodo as string) ?? undefined,
        referenciaExterna: (data.referenciaExterna as string) ?? undefined,
        billingHub: data.billingHub ?? null,
      };
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return NextResponse.json({
    ok: true,
    colegioId,
    colegioName,
    pagos,
  });
}
