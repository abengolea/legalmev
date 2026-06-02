import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';
import { servePagoInvoicePdf } from '@/lib/pago-invoice-server';

type RouteContext = { params: Promise<{ pagoId: string }> };

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

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
  if (data.clienteId !== auth.uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.data();

  return servePagoInvoicePdf(
    adminDb,
    pagoId,
    data,
    {
      email: asString(userData?.email) ?? undefined,
      razonSocial: asString(userData?.name) ?? undefined,
      cuit: asString(userData?.cuit) ?? undefined,
    },
    'Plan Premium LegalMev'
  );
}
