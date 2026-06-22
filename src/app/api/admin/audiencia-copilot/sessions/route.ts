import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import type { AudienciaSessionSummary } from '@/lib/audiencia-session-types';

const COLLECTION = 'audiencia_sessions';

/** Lista sesiones de audiencia del usuario. */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection(COLLECTION)
      .where('userId', '==', auth.uid)
      .limit(50)
      .get();

    const sessions: AudienciaSessionSummary[] = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          titulo: (data.titulo as string) || 'Audiencia sin título',
          updatedAt: (data.updatedAt as string) || '',
          createdAt: (data.createdAt as string) || '',
          testigoCount: Array.isArray(data.testigos) ? data.testigos.length : 0,
          pdfFileName: data.pdfFileName as string | undefined,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({ ok: true, sessions });
  } catch (err) {
    console.error('[audiencia-copilot/sessions GET]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
