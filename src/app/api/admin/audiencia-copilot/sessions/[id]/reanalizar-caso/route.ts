import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { analyzeExpediente, type ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import { analyzeAudiencia, type AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { AudienciaTestigo, RepresentacionCaso } from '@/lib/audiencia-session-types';
import {
  EMPTY_REPRESENTACION,
  mergePreguntasATodos,
  migrateSessionRepreguntas,
  normalizeAudienciaAnalysis,
  normalizeRepreguntas,
  splitRepreguntas,
} from '@/lib/audiencia-session-types';
import type { RepreguntaItem } from '@/lib/audiencia-session-types';
import {
  formatExpedienteContexto,
  formatRepresentacionContexto,
  formatTestimoniosAudienciaContexto,
} from '@/lib/audiencia-copilot-format';

const COLLECTION = 'audiencia_sessions';
const MAX_TEXTO_ANALISIS = 120_000;

export const maxDuration = 300;

function formatIntercambios(intercambios: AudienciaTestigo['intercambios']): string {
  if (intercambios.length === 0) return '(Aún no hay preguntas registradas.)';
  return intercambios
    .map((i, n) => `${n + 1}. P: ${i.pregunta}\n   R: ${i.respuesta}`)
    .join('\n\n');
}

/** Reanaliza mapa del expediente y sugerencias según representación y objetivo estratégico. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    requireGoogleGenAiApiKey();

    const { id: sessionId } = await params;
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

    const body = (await request.json().catch(() => ({}))) as { representacion?: RepresentacionCaso };
    const representacion: RepresentacionCaso =
      body.representacion ?? (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;

    if (!representacion.parte) {
      return NextResponse.json(
        { ok: false, error: 'Indicá la parte que representás antes de reanalizar' },
        { status: 400 }
      );
    }

    const texto = (data.expedienteTexto as string) || '';
    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene texto del expediente' },
        { status: 400 }
      );
    }

    const testigos = (data.testigos as AudienciaTestigo[]) || [];
    const analysisByTestigoId =
      (data.analysisByTestigoId as Record<string, AudienciaCopilotOutput>) || {};

    const textoParaAnalisis =
      texto.length > MAX_TEXTO_ANALISIS
        ? `${texto.slice(0, MAX_TEXTO_ANALISIS)}\n\n[... expediente truncado por tamaño ...]`
        : texto;

    const expedientePrevio = (data.expedienteAnalysis as ExpedienteAnalysisOutput | undefined) ?? null;
    const representacionContexto = formatRepresentacionContexto(representacion, expedientePrevio);
    const testimoniosAudienciaContexto =
      testigos.length > 0
        ? formatTestimoniosAudienciaContexto(
            testigos,
            analysisByTestigoId,
            representacion,
            expedientePrevio?.tipoFuero
          )
        : undefined;

    const expedienteAnalysis = await analyzeExpediente({
      expedienteTexto: textoParaAnalisis,
      representacionContexto,
      testimoniosAudienciaContexto:
        testimoniosAudienciaContexto && testimoniosAudienciaContexto.trim()
          ? testimoniosAudienciaContexto
          : undefined,
    });

    const expedienteContexto = formatExpedienteContexto(expedienteAnalysis);
    const repCtx = formatRepresentacionContexto(representacion, expedienteAnalysis);

    const nextAnalysisMap = { ...analysisByTestigoId };
    let preguntasATodos = normalizeRepreguntas(
      (data.preguntasATodos as RepreguntaItem[] | undefined) ?? []
    );
    const testigosAReanalizar = testigos.filter(
      (t) => t.intercambios.length > 0 || !!analysisByTestigoId[t.id]
    );

    for (const testigo of testigosAReanalizar) {
      const raw = await analyzeAudiencia({
        expedienteContexto,
        representacionContexto: repCtx,
        declaranteNombre: testigo.nombre,
        declaranteRol: testigo.rol,
        contextoDeclarante:
          testigo.contextoDeclarante?.trim() ||
          '(El abogado no agregó contexto sobre este testigo)',
        testimonioPrevio: testigo.testimonioPrevio || '(Sin testimonio previo cargado)',
        intercambiosTexto: formatIntercambios(testigo.intercambios),
      });
      const rawSplit = splitRepreguntas(normalizeRepreguntas(raw.repreguntas));
      preguntasATodos = mergePreguntasATodos(preguntasATodos, rawSplit.todos);
      nextAnalysisMap[testigo.id] = normalizeAudienciaAnalysis({
        ...raw,
        repreguntas: rawSplit.testigo,
      });
    }

    const migrated = migrateSessionRepreguntas({
      preguntasATodos,
      analysisByTestigoId: nextAnalysisMap,
    });

    const now = new Date().toISOString();

    await ref.update({
      representacion,
      expedienteAnalysis,
      analysisByTestigoId: migrated.analysisByTestigoId,
      preguntasATodos: migrated.preguntasATodos,
      alegatoGlobal: '',
      alegatoGlobalMeta: null,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      expedienteAnalysis,
      analysisByTestigoId: migrated.analysisByTestigoId,
      preguntasATodos: migrated.preguntasATodos,
      testigosReanalizados: testigosAReanalizar.length,
      representacion,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID },
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/reanalizar-caso]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
