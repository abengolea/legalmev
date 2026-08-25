import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { assertAudienciaSessionAccess } from '@/lib/audiencia-session-access';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
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
import { mergeTestigosConIdentificados } from '@/lib/audiencia-merge-testigos';
import {
  getCopilotLimitsForContext,
  isAudienciaSessionPaid,
} from '@/lib/audiencia-copilot-limits';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';

const MAX_TEXTO_ANALISIS = 120_000;
const MAX_CONTEXTO_ADICIONAL = 12_000;

export const maxDuration = 300;

function formatIntercambios(intercambios: AudienciaTestigo['intercambios']): string {
  if (intercambios.length === 0) return '(Aún no hay preguntas registradas.)';
  return intercambios
    .map((i, n) => {
      const p = redactSensitiveIdentifiers(i.pregunta);
      const r = redactSensitiveIdentifiers(i.respuesta);
      return `${n + 1}. P: ${p}\n   R: ${r}`;
    })
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
    const accessResult = await assertAudienciaSessionAccess(adminDb, sessionId, auth.uid, 'edit');
    if (!accessResult.ok) {
      return NextResponse.json({ ok: false, error: accessResult.error }, { status: accessResult.status });
    }
    const ref = accessResult.ref;
    const data = accessResult.data;

    const body = (await request.json().catch(() => ({}))) as {
      representacion?: RepresentacionCaso;
      contextoAdicionalAbogado?: string;
      generarPreguntasIniciales?: boolean;
    };
    const representacion: RepresentacionCaso =
      body.representacion ?? (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;

    if (!representacion.parte) {
      return NextResponse.json(
        { ok: false, error: 'Indicá la parte que representás antes de reanalizar' },
        { status: 400 }
      );
    }

    const contextoAdicionalRaw =
      typeof body.contextoAdicionalAbogado === 'string'
        ? body.contextoAdicionalAbogado
        : ((data.contextoAdicionalAbogado as string | undefined) ?? '');
    const contextoAdicionalAbogado = redactSensitiveIdentifiers(
      contextoAdicionalRaw.slice(0, MAX_CONTEXTO_ADICIONAL)
    ).trim();
    const generarPreguntasIniciales = body.generarPreguntasIniciales === true;

    const texto = redactSensitiveIdentifiers((data.expedienteTexto as string) || '');
    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene texto del expediente' },
        { status: 400 }
      );
    }

    if (texto !== (data.expedienteTexto as string)) {
      await ref.update({ expedienteTexto: texto });
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

    const expedienteResult = await analyzeExpediente({
      expedienteTexto: textoParaAnalisis,
      representacionContexto,
      testimoniosAudienciaContexto:
        testimoniosAudienciaContexto && testimoniosAudienciaContexto.trim()
          ? testimoniosAudienciaContexto
          : undefined,
      contextoAdicionalAbogado: contextoAdicionalAbogado || undefined,
    });
    const expedienteAnalysis = expedienteResult.output;
    let tokenUsage = sumTokenUsage(
      normalizeTokenUsage(data.tokenUsage),
      expedienteResult.usage
    );

    const limits = getCopilotLimitsForContext(auth.unlimited, isAudienciaSessionPaid(data));
    let testigosMerged = testigos;
    let testigosAgregados = 0;
    let testigosActualizados = 0;
    if (contextoAdicionalAbogado || generarPreguntasIniciales) {
      const merged = mergeTestigosConIdentificados({
        existing: testigos,
        identified: expedienteAnalysis.testigosIdentificados ?? [],
        declaracionesPrevias: expedienteAnalysis.declaracionesPrevias ?? [],
        representacion,
        tipoFuero: expedienteAnalysis.tipoFuero,
        maxTestigos: limits?.maxTestigos ?? Number.POSITIVE_INFINITY,
      });
      testigosMerged = merged.testigos;
      testigosAgregados = merged.agregados;
      testigosActualizados = merged.actualizados;
    }

    const expedienteContexto = formatExpedienteContexto(
      expedienteAnalysis,
      contextoAdicionalAbogado
    );
    const repCtx = formatRepresentacionContexto(representacion, expedienteAnalysis);

    const nextAnalysisMap = { ...analysisByTestigoId };
    let preguntasATodos = normalizeRepreguntas(
      (data.preguntasATodos as RepreguntaItem[] | undefined) ?? []
    );
    const testigosAReanalizar = generarPreguntasIniciales
      ? testigosMerged
      : testigosMerged.filter(
          (t) => t.intercambios.length > 0 || !!analysisByTestigoId[t.id]
        );

    for (const testigo of testigosAReanalizar) {
      const rawResult = await analyzeAudiencia({
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
      tokenUsage = sumTokenUsage(tokenUsage, rawResult.usage);
      const raw = rawResult.output;
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
    const tokenUsageMeta = {
      ...tokenUsage,
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };

    const testigoActivoId =
      (data.testigoActivoId as string | null) &&
      testigosMerged.some((t) => t.id === data.testigoActivoId)
        ? (data.testigoActivoId as string)
        : (testigosMerged[0]?.id ?? null);

    await ref.update({
      representacion,
      contextoAdicionalAbogado,
      expedienteAnalysis,
      testigos: testigosMerged,
      testigoActivoId,
      analysisByTestigoId: migrated.analysisByTestigoId,
      preguntasATodos: migrated.preguntasATodos,
      alegatoGlobal: '',
      alegatoGlobalMeta: null,
      tokenUsage: tokenUsageMeta,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      expedienteAnalysis,
      analysisByTestigoId: migrated.analysisByTestigoId,
      preguntasATodos: migrated.preguntasATodos,
      testigos: testigosMerged,
      testigoActivoId,
      testigosReanalizados: testigosAReanalizar.length,
      testigosAgregados,
      testigosActualizados,
      representacion,
      contextoAdicionalAbogado,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID, usage: tokenUsage },
      tokenUsage: tokenUsageMeta,
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/reanalizar-caso]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
