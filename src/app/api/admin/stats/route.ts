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

    const [usersSnap, exportacionesSnap, colegiosSnap, pagosSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('exportaciones').get(),
      adminDb.collection('colegios').get(),
      adminDb.collection('pagos').orderBy('createdAt', 'desc').limit(20).get(),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const exportaciones = exportacionesSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, creadoEn: data?.creadoEn as string | undefined };
    });
    const colegios = colegiosSnap.docs.map((d) => d.data());
    const pagos = pagosSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      monto?: number;
      moneda?: string;
      estado?: string;
      tipo?: string;
      createdAt?: string;
      colegioName?: string;
    }>;

    const totalUsers = users.length;
    const totalExportaciones = exportaciones.length;
    const premiumUsers = users.filter((u) => u.tier === 'premium').length;
    const freeUsers = users.filter((u) => (u.tier ?? 'free') === 'free').length;
    const totalColegios = colegios.length;
    const colegiosConConvenioActivo = colegios.filter((c) => c.convenioActivo === true).length;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const exportacionesEsteMes = exportaciones.filter((e) => {
      const t = e.creadoEn ? new Date(e.creadoEn) : null;
      return t && t >= firstDayOfMonth;
    }).length;

    const pagosCompletados = pagos.filter((p) => p.estado === 'completado');
    const ingresosEsteMes = pagosCompletados
      .filter((p) => {
        const t = p.createdAt ? new Date(p.createdAt) : null;
        return t && t >= firstDayOfMonth;
      })
      .reduce((sum, p) => sum + (p.monto ?? 0), 0);
    const ingresosTotales = pagosCompletados.reduce((sum, p) => sum + (p.monto ?? 0), 0);

    const days: string[] = [];
    const exportacionesPorDia: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = exportaciones.filter((e) => {
        const t = e.creadoEn ? new Date(e.creadoEn) : null;
        return t && t >= d && t < next;
      }).length;
      days.push(d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }));
      exportacionesPorDia.push(count);
    }

    const ultimosPagos = pagos.slice(0, 5).map((p) => ({
      id: p.id,
      monto: p.monto ?? 0,
      moneda: p.moneda ?? 'ARS',
      tipo: p.tipo ?? '-',
      estado: p.estado ?? '-',
      colegioName: p.colegioName,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers,
        totalExportaciones,
        exportacionesEsteMes,
        totalColegios,
        colegiosConConvenioActivo,
        ingresosEsteMes,
        ingresosTotales,
        exportacionesPorDia: days.map((d, i) => ({ dia: d, count: exportacionesPorDia[i] })),
        ultimosPagos,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
