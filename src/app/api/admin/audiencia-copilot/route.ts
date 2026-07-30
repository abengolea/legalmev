import { NextRequest, NextResponse } from 'next/server';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { getGoogleGenAiApiKey, requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  getCopilotLimitsForContext,
  countIntercambiosInTexto,
  isAudienciaSessionPaid,
} from '@/lib/audiencia-copilot-limits';
import type { AudienciaTestigo } from '@/lib/audiencia-session-types';
import {
  analyzeAudiencia,
  AudienciaCopilotInputSchema,
} from '@/ai/flows/audiencia-copilot';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const keyConfigured = !!getGoogleGenAiApiKey();
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    let sessionPaid = false;
    if (sessionId) {
      const adminDb = getAdminDb();
      const snap = await adminDb.collection('audiencia_sessions').doc(sessionId).get();
      if (snap.exists && snap.data()?.userId === auth.uid) {
        sessionPaid = isAudienciaSessionPaid(snap.data());
      }
    }
    const limits = getCopilotLimitsForContext(auth.unlimited, sessionPaid);

    return NextResponse.json({
      ok: true,
      provider: 'Google Gemini',
      model: GEMINI_MODEL_ID,
      framework: 'Genkit',
      keyConfigured,
      ready: keyConfigured,
      trialLimits: limits,
      audienciaPagada: sessionPaid,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    requireGoogleGenAiApiKey();

    const body = await request.json();
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : undefined;
    const parsed = AudienciaCopilotInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (sessionId) {
      const adminDb = getAdminDb();
      const ref = adminDb.collection('audiencia_sessions').doc(sessionId);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.userId === auth.uid) {
        const sessionPaid = isAudienciaSessionPaid(snap.data());
        const effectiveLimits = getCopilotLimitsForContext(auth.unlimited, sessionPaid);
        if (effectiveLimits) {
          const testigos = (snap.data()?.testigos as AudienciaTestigo[]) ?? [];
          const declaranteNombre = parsed.data.declaranteNombre?.trim().toLowerCase();
          const intercambiosActuales = countIntercambiosInTexto(parsed.data.intercambiosTexto);
          const perErr =
            intercambiosActuales > effectiveLimits.maxIntercambiosPerTestigo
              ? `La prueba permite hasta ${effectiveLimits.maxIntercambiosPerTestigo} preguntas por declarante.`
              : null;
          if (perErr) {
            return NextResponse.json({ ok: false, error: perErr, code: 'TRIAL_LIMIT' }, { status: 403 });
          }
          const otrosIntercambios = testigos
            .filter((t) => t.nombre.trim().toLowerCase() !== declaranteNombre)
            .reduce((n, t) => n + (t.intercambios?.length ?? 0), 0);
          const totalIntercambios = otrosIntercambios + intercambiosActuales;
          if (totalIntercambios > effectiveLimits.maxIntercambiosTotal) {
            return NextResponse.json(
              {
                ok: false,
                error: `La fase de prueba permite hasta ${effectiveLimits.maxIntercambiosTotal} preguntas y respuestas en total. Escribinos si necesitás seguir o querés dejarnos tu devolución.`,
                code: 'TRIAL_LIMIT',
              },
              { status: 403 }
            );
          }
        }
      }
    }

    const { output: result, usage } = await analyzeAudiencia({
      ...parsed.data,
      expedienteContexto: redactSensitiveIdentifiers(parsed.data.expedienteContexto),
      representacionContexto: redactSensitiveIdentifiers(parsed.data.representacionContexto),
      contextoDeclarante: redactSensitiveIdentifiers(parsed.data.contextoDeclarante),
      testimonioPrevio: redactSensitiveIdentifiers(parsed.data.testimonioPrevio),
      intercambiosTexto: redactSensitiveIdentifiers(parsed.data.intercambiosTexto),
    });
    const now = new Date().toISOString();
    let tokenUsage = {
      ...usage,
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };

    if (sessionId) {
      const adminDb = getAdminDb();
      const ref = adminDb.collection('audiencia_sessions').doc(sessionId);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.userId === auth.uid) {
        tokenUsage = {
          ...sumTokenUsage(normalizeTokenUsage(snap.data()?.tokenUsage), usage),
          model: GEMINI_MODEL_ID,
          lastUpdatedAt: now,
        };
        await ref.update({ tokenUsage, updatedAt: now });
      }
    }

    return NextResponse.json({
      ok: true,
      analysis: result,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID, usage },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
