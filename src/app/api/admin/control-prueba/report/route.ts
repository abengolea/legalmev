import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { CONTROL_PRUEBA_COLLECTION } from '@/lib/control-prueba';
import {
  mapExpedienteDocToReportRow,
  summarizeControlPruebaReport,
  type ControlPruebaReportRow,
} from '@/lib/control-prueba-admin-report';

const MAX_EXPEDIENTES = 500;

/**
 * GET /api/admin/control-prueba/report
 * Listado de expedientes de Control de Pruebas con tokens consumidos.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(CONTROL_PRUEBA_COLLECTION).limit(MAX_EXPEDIENTES).get();

    const docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .sort((a, b) => {
        const aDate =
          (typeof a.data.updatedAt === 'string' ? a.data.updatedAt : '') ||
          (typeof a.data.createdAt === 'string' ? a.data.createdAt : '') ||
          a.data.updatedAt?.toDate?.()?.toISOString?.() ||
          a.data.createdAt?.toDate?.()?.toISOString?.() ||
          '';
        const bDate =
          (typeof b.data.updatedAt === 'string' ? b.data.updatedAt : '') ||
          (typeof b.data.createdAt === 'string' ? b.data.createdAt : '') ||
          b.data.updatedAt?.toDate?.()?.toISOString?.() ||
          b.data.createdAt?.toDate?.()?.toISOString?.() ||
          '';
        return String(bDate).localeCompare(String(aDate));
      });

    const userIds = [...new Set(docs.map((d) => d.data.createdBy as string).filter(Boolean))];
    const userMap = new Map<string, { name?: string; email?: string }>();

    for (let i = 0; i < userIds.length; i += 10) {
      const batch = userIds.slice(i, i + 10);
      const refs = batch.map((id) => adminDb.collection('users').doc(id));
      const userSnaps = await adminDb.getAll(...refs);
      for (const userSnap of userSnaps) {
        if (!userSnap.exists) continue;
        const u = userSnap.data()!;
        userMap.set(userSnap.id, {
          name: typeof u.name === 'string' ? u.name : undefined,
          email: typeof u.email === 'string' ? u.email : undefined,
        });
      }
    }

    let rows: ControlPruebaReportRow[] = docs.map(({ id, data }) =>
      mapExpedienteDocToReportRow(id, data, userMap.get(data.createdBy as string))
    );

    const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.caratula.toLowerCase().includes(q) ||
          r.userEmail.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q) ||
          r.numeroExpediente?.toLowerCase().includes(q) ||
          r.pdfFileName?.toLowerCase().includes(q)
      );
    }

    const summary = summarizeControlPruebaReport(rows);
    const summaryAll = summarizeControlPruebaReport(
      docs.map(({ id, data }) =>
        mapExpedienteDocToReportRow(id, data, userMap.get(data.createdBy as string))
      )
    );

    return NextResponse.json({
      ok: true,
      rows,
      summary,
      summaryAll,
      truncated: snap.size >= MAX_EXPEDIENTES,
    });
  } catch (err) {
    console.error('[admin/control-prueba/report]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
