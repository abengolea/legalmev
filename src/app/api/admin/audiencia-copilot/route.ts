import { NextRequest, NextResponse } from 'next/server';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { getGoogleGenAiApiKey, requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  analyzeAudiencia,
  AudienciaCopilotInputSchema,
} from '@/ai/flows/audiencia-copilot';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const keyConfigured = !!getGoogleGenAiApiKey();

    return NextResponse.json({
      ok: true,
      provider: 'Google Gemini',
      model: GEMINI_MODEL_ID,
      framework: 'Genkit',
      keyConfigured,
      ready: keyConfigured,
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

    const { output: result, usage } = await analyzeAudiencia(parsed.data);
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
