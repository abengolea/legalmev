import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
import { refinarAlegatosGlobales } from '@/ai/flows/audiencia-alegatos-globales-refinar';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { AudienciaSessionData, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import {
  formatExpedienteContexto,
  formatRepresentacionContexto,
  formatTestimoniosAudienciaContexto,
  formatDocumentosAdicionalesContexto,
} from '@/lib/audiencia-copilot-format';

const COLLECTION = 'audiencia_sessions';

const BodySchema = z.object({
  instrucciones: z.string().trim().min(3, 'Las instrucciones son muy cortas'),
  alegatoActual: z.string().trim().min(20, 'El alegato actual está vacío o es muy corto'),
});

export const maxDuration = 120;

/** Refina el alegato global existente según instrucciones del abogado. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    requireGoogleGenAiApiKey();

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }

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

    const representacion = (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;
    const expedienteAnalysis = data.expedienteAnalysis as ExpedienteAnalysisOutput | null;
    const testigos = (data.testigos as AudienciaSessionData['testigos']) || [];
    const analysisByTestigoId =
      (data.analysisByTestigoId as Record<string, AudienciaCopilotOutput>) || {};
    const meta = data.alegatoGlobalMeta as AudienciaSessionData['alegatoGlobalMeta'];

    if (!expedienteAnalysis) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene expediente analizado' },
        { status: 400 }
      );
    }

    if (!representacion.parte) {
      return NextResponse.json(
        { ok: false, error: 'Configurá y guardá la representación antes de refinar alegatos' },
        { status: 400 }
      );
    }

    const puntosFuertesActuales = meta?.puntosFuertes?.length
      ? meta.puntosFuertes.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : undefined;
    const debilidadesContrariaActuales = meta?.debilidadesContraria?.length
      ? meta.debilidadesContraria.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : undefined;

    const refineResult = await refinarAlegatosGlobales({
      instrucciones: parsed.data.instrucciones,
      alegatoActual: parsed.data.alegatoActual,
      puntosFuertesActuales,
      debilidadesContrariaActuales,
      representacionContexto: formatRepresentacionContexto(representacion, expedienteAnalysis),
      expedienteContexto: formatExpedienteContexto(expedienteAnalysis),
      testimoniosAudienciaTexto: formatTestimoniosAudienciaContexto(
        testigos,
        analysisByTestigoId,
        representacion,
        expedienteAnalysis.tipoFuero
      ),
      documentosAdicionalesTexto:
        formatDocumentosAdicionalesContexto(
          data.documentosAdicionales as AudienciaSessionData['documentosAdicionales']
        ) || undefined,
      caratula: expedienteAnalysis.caratula,
    });

    const result = refineResult.output;
    const now = new Date().toISOString();
    const tokenUsage = {
      ...sumTokenUsage(normalizeTokenUsage(data.tokenUsage), refineResult.usage),
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };
    const alegatoGlobalMeta = {
      puntosFuertes: result.puntosFuertes,
      debilidadesContraria: result.debilidadesContraria,
      generadoAt: meta?.generadoAt ?? now,
      refinadoAt: now,
      ultimasInstrucciones: parsed.data.instrucciones,
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
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID, usage: refineResult.usage },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/alegatos-globales/refinar]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
