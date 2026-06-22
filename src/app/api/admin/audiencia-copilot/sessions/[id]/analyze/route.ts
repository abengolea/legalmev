import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { analyzeExpediente } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaTestigo, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import { inferBandejaDeclarante } from '@/lib/audiencia-copilot-format';

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
    const ref = adminDb.collection(COLLECTION).doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Sesión no encontrada' }, { status: 404 });
    }

    const data = snap.data()!;
    if (data.userId !== auth.uid) {
      return NextResponse.json({ ok: false, error: 'Sin permiso' }, { status: 403 });
    }

    const texto = (data.expedienteTexto as string) || '';
    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, error: 'La sesión no tiene texto del expediente' },
        { status: 400 }
      );
    }

    const textoParaAnalisis =
      texto.length > MAX_TEXTO_ANALISIS
        ? `${texto.slice(0, MAX_TEXTO_ANALISIS)}\n\n[... expediente truncado por tamaño ...]`
        : texto;

    const analysis = await analyzeExpediente({ expedienteTexto: textoParaAnalisis });

    const representacion = (data.representacion as RepresentacionCaso) ?? EMPTY_REPRESENTACION;

    const testigos: AudienciaTestigo[] = analysis.testigosIdentificados.map((t) => ({
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

    const titulo =
      analysis.caratula?.trim() ||
      (data.titulo as string) ||
      (data.pdfFileName as string)?.replace(/\.pdf$/i, '') ||
      'Audiencia';

    const testigoActivoId = testigos[0]?.id ?? null;
    const now = new Date().toISOString();

    await ref.update({
      titulo,
      expedienteAnalysis: analysis,
      analysisStatus: 'ready',
      testigos,
      testigoActivoId,
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
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID },
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/analyze]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
