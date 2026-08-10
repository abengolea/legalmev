import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import type { AudienciaSessionSummary } from '@/lib/audiencia-session-types';
import { resolveResourceAccess } from '@/lib/resource-sharing';

const COLLECTION = 'audiencia_sessions';

/** Lista sesiones de audiencia del usuario (propias + compartidas). */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const [ownedSnap, sharedSnap] = await Promise.all([
      adminDb.collection(COLLECTION).where('userId', '==', auth.uid).limit(50).get(),
      adminDb
        .collection(COLLECTION)
        .where('sharedWithUids', 'array-contains', auth.uid)
        .limit(50)
        .get(),
    ]);

    const byId = new Map<string, AudienciaSessionSummary>();
    const push = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data();
      const access = resolveResourceAccess(data, auth.uid, 'userId');
      byId.set(d.id, {
        id: d.id,
        titulo: (data.titulo as string) || 'Audiencia sin título',
        updatedAt: (data.updatedAt as string) || '',
        createdAt: (data.createdAt as string) || '',
        testigoCount: Array.isArray(data.testigos) ? data.testigos.length : 0,
        pdfFileName: data.pdfFileName as string | undefined,
        myAccess: access ?? undefined,
      });
    };
    for (const d of ownedSnap.docs) push(d);
    for (const d of sharedSnap.docs) {
      if (!byId.has(d.id)) push(d);
    }

    const sessions = Array.from(byId.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );

    return NextResponse.json({
      ok: true,
      sessions,
      canCreate: auth.access.hasAccess && (auth.unlimited || (auth.access.remaining ?? 0) > 0),
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions GET]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
