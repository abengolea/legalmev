import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { assertAudienciaSessionAccess } from '@/lib/audiencia-session-access';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
import { analyzeExpediente } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaTestigo, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import { inferBandejaDeclarante } from '@/lib/audiencia-copilot-format';
import {
  capTestigosForTrial,
  TRIAL_COPILOT_LIMITS,
} from '@/lib/audiencia-copilot-limits';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';

const COLLECTION = 'audiencia_sessions';
const MAX_TEXTO_ANALISIS = 120_000;

export const maxDuration = 120;

/** Paso 2: analiza el texto ya extraído y completa la sesión. */
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

    const texto = redactSensitiveIdentifiers((data.expedienteTexto as string) || '');
    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene texto del expediente' },
        { status: 400 }
      );
    }

    // Sesiones antiguas pueden tener texto sin redactar: persistimos la versión limpia.
    if (texto !== (data.expedienteTexto as string)) {
      await ref.update({ expedienteTexto: texto });
    }

    const textoParaAnalisis =
      texto.length > MAX_TEXTO_ANALISIS
        ? `${texto.slice(0, MAX_TEXTO_ANALISIS)}\n\n[... expediente truncado por tamaño ...]`
        : texto;

    const { output: analysis, usage } = await analyzeExpediente({ expedienteTexto: textoParaAnalisis });

    const representacion = (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;
    const now = new Date().toISOString();
    const tokenUsage = {
      ...sumTokenUsage(normalizeTokenUsage(data.tokenUsage), usage),
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };

    const testigosRaw: AudienciaTestigo[] = analysis.testigosIdentificados.map((t) => ({
      id: randomUUID(),
      nombre: t.nombre,
      rol: t.rol,
      bandeja: inferBandejaDeclarante(
        t.parteProcesal ?? 'desconocido',
        representacion,
        analysis.tipoFuero
      ),
      testimonioPrevio:
        analysis.declaracionesPrevias.find(
          (d) => d.nombre.toLowerCase() === t.nombre.toLowerCase()
        )?.resumen ?? t.relevancia,
      contextoDeclarante: '',
      intercambios: [],
      testimonioCerrado: false,
    }));

    const testigos = capTestigosForTrial(
      testigosRaw,
      auth.unlimited,
      TRIAL_COPILOT_LIMITS.maxTestigos
    );
    const testigosTruncados =
      !auth.unlimited && testigosRaw.length > testigos.length
        ? testigosRaw.length - testigos.length
        : 0;

    const titulo =
      analysis.caratula?.trim() ||
      (data.titulo as string) ||
      (data.pdfFileName as string)?.replace(/\.pdf$/i, '') ||
      'Audiencia';

    const testigoActivoId = testigos[0]?.id ?? null;

    await ref.update({
      titulo,
      expedienteAnalysis: analysis,
      analysisStatus: 'ready',
      testigos,
      testigoActivoId,
      tokenUsage,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      sessionId,
      analysis,
      testigos,
      testigoActivoId,
      titulo,
      step: 'analyzed',
      testigosTruncados,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID, usage },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/analyze]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
