import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/stats
 * Estadísticas del sistema. Solo admins.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const role = userSnap.data()?.role;
    if (role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const [usersSnap, exportacionesSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('exportaciones').get(),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const exportaciones = exportacionesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const totalUsers = users.length;
    const totalExportaciones = exportaciones.length;
    const premiumUsers = users.filter((u) => u.tier === 'premium').length;
    const freeUsers = users.filter((u) => (u.tier ?? 'free') === 'free').length;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const exportacionesEsteMes = exportaciones.filter((e: { creadoEn?: string }) => {
      const t = e.creadoEn ? new Date(e.creadoEn) : null;
      return t && t >= firstDayOfMonth;
    }).length;

    return NextResponse.json({
      ok: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers,
        totalExportaciones,
        exportacionesEsteMes,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
