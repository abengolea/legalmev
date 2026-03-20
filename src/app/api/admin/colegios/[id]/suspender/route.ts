import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/** Verifica que el usuario sea admin */
async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: 'No autenticado' as const, status: 401 };
  const adminAuth = getAuth();
  const decoded = await adminAuth.verifyIdToken(token);
  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (userSnap.data()?.role !== 'admin') return { error: 'Solo administradores' as const, status: 403 };
  return { uid: decoded.uid, adminDb };
}

/**
 * POST /api/admin/colegios/[id]/suspender
 * Suspende el convenio: pasa convenioActivo a false y quita premium a todos los miembros.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const { id: colegioId } = await params;
    const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
    if (!colegioSnap.exists) return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });

    await adminDb.collection('colegios').doc(colegioId).update({
      convenioActivo: false,
      updatedAt: new Date().toISOString(),
    });

    const usersSnap = await adminDb.collection('users').where('colegioId', '==', colegioId).get();
    let suspendidos = 0;
    const batch = adminDb.batch();
    for (const doc of usersSnap.docs) {
      batch.update(doc.ref, {
        tier: 'free',
        colegioId: null,
        premiumSource: null,
        colegioName: null,
        updatedAt: new Date().toISOString(),
      });
      suspendidos++;
    }
    await batch.commit();

    return NextResponse.json({
      ok: true,
      suspendidos,
      message: `Convenio suspendido. ${suspendidos} usuarios pasaron a plan gratuito.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
