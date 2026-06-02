import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

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
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

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
