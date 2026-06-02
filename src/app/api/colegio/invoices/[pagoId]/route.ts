import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { resolveColegioAdmin } from '@/lib/colegio-admin-auth';
import { buyerFromColegioData, servePagoInvoicePdf } from '@/lib/pago-invoice-server';

type RouteContext = { params: Promise<{ pagoId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { pagoId } = await context.params;
  if (!pagoId || pagoId.includes('/')) {
    return NextResponse.json({ error: 'Pago inválido' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const snap = await adminDb.collection('pagos').doc(pagoId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  }

  const data = snap.data() ?? {};
  if (data.tipo !== 'colegio' || !data.colegioId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const platformAuth = await requirePlatformAdmin(request);
  if (platformAuth instanceof NextResponse) {
    const colegioAuth = await resolveColegioAdmin(request);
    if (colegioAuth instanceof NextResponse) return colegioAuth;
    if (colegioAuth.colegioId !== data.colegioId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  const colegioSnap = await adminDb.collection('colegios').doc(data.colegioId as string).get();
  const colegioData = colegioSnap.data() ?? {};
  const colegioName = (colegioData.name as string) ?? 'Colegio';
  const periodo = data.periodo ? ` (${data.periodo})` : '';
  const defaultDescription = `Cuota convenio LegalMev - ${colegioName}${periodo}`;

  return servePagoInvoicePdf(
    adminDb,
    pagoId,
    data,
    buyerFromColegioData(colegioData),
    defaultDescription
  );
}
