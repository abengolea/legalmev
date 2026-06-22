import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
import { generarAlegatosGlobales } from '@/ai/flows/audiencia-alegatos-globales';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { AudienciaSessionData, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import {
  formatExpedienteContexto,
  formatRepresentacionContexto,
  formatTestimoniosAudienciaContexto,
} from '@/lib/audiencia-copilot-format';

const COLLECTION = 'audiencia_sessions';

export const maxDuration = 120;

/** Genera el alegato de cierre global integrando todos los testimonios cerrados. */
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

    const testigos = (data.testigos as AudienciaSessionData['testigos']) || [];
    const representacion = (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;
    const expedienteAnalysis = data.expedienteAnalysis as ExpedienteAnalysisOutput | null;

    if (!expedienteAnalysis) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene expediente analizado' },
        { status: 400 }
      );
    }

    if (!representacion.parte) {
      return NextResponse.json(
        { ok: false, error: 'Configurá y guardá la representación antes de armar alegatos' },
        { status: 400 }
      );
    }

    if (testigos.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No hay declarantes en la audiencia' },
        { status: 400 }
      );
    }

    const pendientes = testigos.filter((t) => !t.testimonioCerrado);
    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Faltan cerrar ${pendientes.length} testimonio(s): ${pendientes.map((t) => t.nombre).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const analysisByTestigoId =
      (data.analysisByTestigoId as Record<string, AudienciaCopilotOutput>) || {};

    const alegatosResult = await generarAlegatosGlobales({
      expedienteContexto: formatExpedienteContexto(expedienteAnalysis),
      representacionContexto: formatRepresentacionContexto(representacion, expedienteAnalysis),
      testimoniosAudienciaTexto: formatTestimoniosAudienciaContexto(
        testigos,
        analysisByTestigoId,
        representacion,
        expedienteAnalysis.tipoFuero
      ),
      caratula: expedienteAnalysis.caratula,
    });
    const result = alegatosResult.output;
    const now = new Date().toISOString();
    const tokenUsage = {
      ...sumTokenUsage(normalizeTokenUsage(data.tokenUsage), alegatosResult.usage),
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };
    const alegatoGlobalMeta = {
      puntosFuertes: result.puntosFuertes,
      debilidadesContraria: result.debilidadesContraria,
      generadoAt: now,
    };

    await ref.update({
      alegatoGlobal: result.alegatoGlobal,
      alegatoGlobalMeta,
      tokenUsage,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      alegatoGlobal: result.alegatoGlobal,
      alegatoGlobalMeta,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID, usage: alegatosResult.usage },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/alegatos-globales]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
