import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { assertAudienciaSessionAccess } from '@/lib/audiencia-session-access';
import type { DocumentoAdicionalAudiencia } from '@/lib/audiencia-session-types';

const COLLECTION = 'audiencia_sessions';

/** Elimina un documento adicional de la sesión. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id: sessionId, docId } = await params;
    const adminDb = getAdminDb();
    const accessResult = await assertAudienciaSessionAccess(adminDb, sessionId, auth.uid, 'edit');
    if (!accessResult.ok) {
      return NextResponse.json({ ok: false, error: accessResult.error }, { status: accessResult.status });
    }
    const ref = accessResult.ref;
    const data = accessResult.data;

    const existing = (data.documentosAdicionales as DocumentoAdicionalAudiencia[]) || [];
    const documentosAdicionales = existing.filter((d) => d.id !== docId);

    if (documentosAdicionales.length === existing.length) {
      return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });
    }

    const now = new Date().toISOString();
    await ref.update({ documentosAdicionales, updatedAt: now });

    return NextResponse.json({ ok: true, documentosAdicionales });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/documentos-adicionales DELETE]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
