import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import type { AudienciaSessionData, AudienciaSessionPatch, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';

const COLLECTION = 'audiencia_sessions';

async function getOwnedSession(uid: string, sessionId: string) {
  const adminDb = getAdminDb();
  const ref = adminDb.collection(COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'Sesión no encontrada', status: 404 as const };
  const data = snap.data();
  if (data?.userId !== uid) return { error: 'Sin permiso', status: 403 as const };
  return { ref, data, id: snap.id };
}

/** Obtiene una sesión completa. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const result = await getOwnedSession(auth.uid, id);
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const session: AudienciaSessionData = {
      id: result.id,
      userId: result.data!.userId as string,
      titulo: (result.data!.titulo as string) || 'Audiencia',
      pdfFileName: result.data!.pdfFileName as string | undefined,
      analysisStatus: (result.data!.analysisStatus as AudienciaSessionData['analysisStatus']) ?? 'ready',
      expedienteAnalysis: result.data!.expedienteAnalysis ?? null,
      expedienteTexto: result.data!.expedienteTexto as string | undefined,
      testigos: (result.data!.testigos as AudienciaSessionData['testigos']) || [],
      testigoActivoId: (result.data!.testigoActivoId as string | null) ?? null,
      analysisByTestigoId:
        (result.data!.analysisByTestigoId as AudienciaSessionData['analysisByTestigoId']) || {},
      representacion: (result.data!.representacion as RepresentacionCaso) ?? { ...EMPTY_REPRESENTACION },
      alegatoGlobal: result.data!.alegatoGlobal as string | undefined,
      alegatoGlobalMeta: result.data!.alegatoGlobalMeta as AudienciaSessionData['alegatoGlobalMeta'],
      createdAt: (result.data!.createdAt as string) || '',
      updatedAt: (result.data!.updatedAt as string) || '',
    };

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/[id] GET]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Actualiza testigos, declarante activo y análisis (auto-guardado). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const result = await getOwnedSession(auth.uid, id);
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const body = (await request.json()) as AudienciaSessionPatch;
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.titulo !== undefined) update.titulo = body.titulo;
    if (body.testigos !== undefined) update.testigos = body.testigos;
    if (body.testigoActivoId !== undefined) update.testigoActivoId = body.testigoActivoId;
    if (body.analysisByTestigoId !== undefined) update.analysisByTestigoId = body.analysisByTestigoId;
    if (body.representacion !== undefined) update.representacion = body.representacion;
    if (body.alegatoGlobal !== undefined) update.alegatoGlobal = body.alegatoGlobal;
    if (body.alegatoGlobalMeta !== undefined) update.alegatoGlobalMeta = body.alegatoGlobalMeta;

    await result.ref!.update(update);

    return NextResponse.json({ ok: true, updatedAt: update.updatedAt });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/[id] PATCH]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

/** Elimina una sesión. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const result = await getOwnedSession(auth.uid, id);
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    await result.ref!.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/[id] DELETE]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
