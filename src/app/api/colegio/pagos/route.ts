import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { resolveColegioAdmin } from '@/lib/colegio-admin-auth';

/**
 * GET /api/colegio/pagos?colegioId=...
 * Historial de cuotas del colegio.
 * - Superadmin: requiere colegioId.
 * - Responsable de colegio: usa su colegio (sin colegioId).
 */
export async function GET(request: NextRequest) {
  const adminDb = getAdminDb();
  const colegioIdParam = new URL(request.url).searchParams.get('colegioId')?.trim();

  let colegioId = colegioIdParam;

  const platformAuth = await requirePlatformAdmin(request);
  if (platformAuth instanceof NextResponse) {
    const colegioAuth = await resolveColegioAdmin(request);
    if (colegioAuth instanceof NextResponse) return colegioAuth;
    colegioId = colegioAuth.colegioId;
  } else if (!colegioId) {
    return NextResponse.json({ ok: false, error: 'Se requiere colegioId' }, { status: 400 });
  }

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
