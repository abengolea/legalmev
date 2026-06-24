import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import {
  mapSessionDocToReportRow,
  summarizeAudienciaReport,
  type AudienciaCopilotReportRow,
} from '@/lib/audiencia-copilot-admin-report';

const COLLECTION = 'audiencia_sessions';
const MAX_SESSIONS = 500;

/**
 * GET /api/admin/audiencia-copilot/report
 * Listado de audiencias del copiloto (prueba y pagas) con tokens consumidos.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(COLLECTION).limit(MAX_SESSIONS).get();

    const docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() }))
      .sort((a, b) => {
        const aDate = (a.data.updatedAt as string) || (a.data.createdAt as string) || '';
        const bDate = (b.data.updatedAt as string) || (b.data.createdAt as string) || '';
        return bDate.localeCompare(aDate);
      });

    const userIds = [...new Set(docs.map((d) => d.data.userId as string).filter(Boolean))];
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

    const tipoFilter = request.nextUrl.searchParams.get('tipo');
    let rows: AudienciaCopilotReportRow[] = docs.map(({ id, data }) =>
      mapSessionDocToReportRow(id, data, userMap.get(data.userId as string))
    );

    if (tipoFilter === 'prueba') {
      rows = rows.filter((r) => r.tipo === 'prueba');
    } else if (tipoFilter === 'pagada') {
      rows = rows.filter((r) => r.tipo === 'pagada');
    }

    const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.titulo.toLowerCase().includes(q) ||
          r.userEmail.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q) ||
          r.pdfFileName?.toLowerCase().includes(q)
      );
    }

    const summary = summarizeAudienciaReport(rows);
    const summaryAll = summarizeAudienciaReport(
      docs.map(({ id, data }) =>
        mapSessionDocToReportRow(id, data, userMap.get(data.userId as string))
      )
    );

    return NextResponse.json({
      ok: true,
      rows,
      summary,
      summaryAll,
      truncated: snap.size >= MAX_SESSIONS,
    });
  } catch (err) {
    console.error('[admin/audiencia-copilot/report]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
