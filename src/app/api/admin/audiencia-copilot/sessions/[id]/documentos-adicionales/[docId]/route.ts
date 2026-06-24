import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
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
    const ref = adminDb.collection(COLLECTION).doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Sesión no encontrada' }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.userId !== auth.uid) {
      return NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 });
    }

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
