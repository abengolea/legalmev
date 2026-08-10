import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { assertAudienciaSessionAccess } from '@/lib/audiencia-session-access';
import type {
  AudienciaSessionData,
  AudienciaSessionPatch,
  AudienciaTestigo,
  RepresentacionCaso,
} from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import {
  countAudienciaSessionUsage,
  getCopilotLimitsForContext,
  isAudienciaSessionPaid,
  trialIntercambioLimitForTestigo,
  trialLimitError,
} from '@/lib/audiencia-copilot-limits';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';
import { normalizeSharedWith } from '@/lib/resource-sharing';

const COLLECTION = 'audiencia_sessions';

function redactTestigosForStorage(testigos: AudienciaTestigo[]): AudienciaTestigo[] {
  return testigos.map((t) => ({
    ...t,
    contextoDeclarante: t.contextoDeclarante
      ? redactSensitiveIdentifiers(t.contextoDeclarante)
      : t.contextoDeclarante,
    testimonioPrevio: t.testimonioPrevio
      ? redactSensitiveIdentifiers(t.testimonioPrevio)
      : t.testimonioPrevio,
    intercambios: (t.intercambios ?? []).map((i) => ({
      ...i,
      pregunta: redactSensitiveIdentifiers(i.pregunta),
      respuesta: redactSensitiveIdentifiers(i.respuesta),
    })),
  }));
}

function toSessionData(
  id: string,
  data: FirebaseFirestore.DocumentData,
): AudienciaSessionData {
  return {
    id,
    userId: data.userId as string,
    titulo: (data.titulo as string) || 'Audiencia',
    pdfFileName: data.pdfFileName as string | undefined,
    analysisStatus: (data.analysisStatus as AudienciaSessionData['analysisStatus']) ?? 'ready',
    expedienteAnalysis: data.expedienteAnalysis ?? null,
    expedienteTexto: data.expedienteTexto as string | undefined,
    testigos: (data.testigos as AudienciaSessionData['testigos']) || [],
    testigoActivoId: (data.testigoActivoId as string | null) ?? null,
    analysisByTestigoId:
      (data.analysisByTestigoId as AudienciaSessionData['analysisByTestigoId']) || {},
    preguntasATodos: (data.preguntasATodos as AudienciaSessionData['preguntasATodos']) || [],
    representacion: (data.representacion as RepresentacionCaso) ?? { ...EMPTY_REPRESENTACION },
    alegatoGlobal: data.alegatoGlobal as string | undefined,
    alegatoGlobalMeta: data.alegatoGlobalMeta as AudienciaSessionData['alegatoGlobalMeta'],
    documentosAdicionales:
      (data.documentosAdicionales as AudienciaSessionData['documentosAdicionales']) || [],
    tokenUsage: data.tokenUsage as AudienciaSessionData['tokenUsage'],
    audienciaPagada: data.audienciaPagada === true,
    audienciaPagoMeta: data.audienciaPagoMeta as AudienciaSessionData['audienciaPagoMeta'],
    sharedWith: normalizeSharedWith(data.sharedWith),
    createdAt: (data.createdAt as string) || '',
    updatedAt: (data.updatedAt as string) || '',
  };
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
    const adminDb = getAdminDb();
    const result = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'view');
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const session = toSessionData(result.id, result.data);

    return NextResponse.json({
      ok: true,
      session,
      myAccess: result.access,
      audienciaPagada: session.audienciaPagada === true,
    });
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
    const adminDb = getAdminDb();
    const result = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'edit');
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const body = (await request.json()) as AudienciaSessionPatch;
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Límites según dueño (cuota / ilimitado del owner) y si la sesión está pagada.
    let ownerUnlimited = result.access === 'owner' ? auth.unlimited : false;
    if (result.access !== 'owner' && result.ownerUid) {
      const ownerSnap = await adminDb.collection('users').doc(result.ownerUid).get();
      const ownerData = ownerSnap.data();
      if (ownerData) {
        const { resolveAudienciaCopilotAccess } = await import('@/lib/audiencia-copilot-access');
        ownerUnlimited = resolveAudienciaCopilotAccess({
          email: ownerData.email as string | undefined,
          audienciaCopilotTrial: ownerData.audienciaCopilotTrial,
        }).unlimited;
      }
    }

    const effectiveLimits = getCopilotLimitsForContext(
      ownerUnlimited,
      isAudienciaSessionPaid(result.data)
    );

    if (effectiveLimits && body.testigos !== undefined) {
      if (body.testigos.length > effectiveLimits.maxTestigos) {
        return NextResponse.json(
          {
            ok: false,
            error: trialLimitError(
              effectiveLimits,
              { testigos: body.testigos.length, intercambiosTotal: 0, documentosAdicionales: 0 },
              'add_testigo'
            ),
            code: 'TRIAL_LIMIT',
          },
          { status: 403 }
        );
      }
      const usage = countAudienciaSessionUsage({ testigos: body.testigos });
      const totalErr = trialLimitError(effectiveLimits, usage, 'add_intercambio');
      if (totalErr) {
        return NextResponse.json({ ok: false, error: totalErr, code: 'TRIAL_LIMIT' }, { status: 403 });
      }
      for (const testigo of body.testigos) {
        const perErr = trialIntercambioLimitForTestigo(effectiveLimits, testigo);
        if (perErr) {
          return NextResponse.json({ ok: false, error: perErr, code: 'TRIAL_LIMIT' }, { status: 403 });
        }
      }
    }

    if (body.titulo !== undefined) update.titulo = body.titulo;
    if (body.testigos !== undefined) update.testigos = redactTestigosForStorage(body.testigos);
    if (body.testigoActivoId !== undefined) update.testigoActivoId = body.testigoActivoId;
    if (body.analysisByTestigoId !== undefined) update.analysisByTestigoId = body.analysisByTestigoId;
    if (body.preguntasATodos !== undefined) update.preguntasATodos = body.preguntasATodos;
    if (body.representacion !== undefined) {
      const rep = body.representacion;
      update.representacion = {
        ...rep,
        notas: rep.notas ? redactSensitiveIdentifiers(rep.notas) : rep.notas,
      };
    }
    if (body.alegatoGlobal !== undefined) {
      update.alegatoGlobal = redactSensitiveIdentifiers(body.alegatoGlobal);
    }
    if (body.alegatoGlobalMeta !== undefined) update.alegatoGlobalMeta = body.alegatoGlobalMeta;
    if (body.tokenUsage !== undefined) update.tokenUsage = body.tokenUsage;

    await result.ref.update(update);

    return NextResponse.json({ ok: true, updatedAt: update.updatedAt, myAccess: result.access });
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
    const adminDb = getAdminDb();
    const result = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'owner');
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    await result.ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/[id] DELETE]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
