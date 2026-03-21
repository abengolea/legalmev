import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/users/[id]/exportaciones
 * Lista exportaciones de un usuario. Solo admins.
 * Query: ?limit=20 (default 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

    const snap = await adminDb
      .collection('exportaciones')
      .where('userId', '==', targetUserId)
      .limit(500)
      .get();

    const exportaciones = snap.docs
      .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        expedienteNumero: data.expedienteNumero ?? '',
        cantidadActuaciones: data.cantidadActuaciones ?? 0,
        caratula: data.caratula ?? '',
        juzgado: data.juzgado ?? '',
        filename: data.filename ?? '',
        creadoEn: data.creadoEn ?? '',
      };
    })
      .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''))
      .slice(0, limit);

    return NextResponse.json({ ok: true, exportaciones });
  } catch (err) {
    console.error('[admin/users/exportaciones]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
