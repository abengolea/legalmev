import { NextRequest, NextResponse } from 'next/server';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { getGoogleGenAiApiKey, requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import {
  analyzeAudiencia,
  AudienciaCopilotInputSchema,
} from '@/ai/flows/audiencia-copilot';

import { GEMINI_MODEL_ID } from '@/lib/gemini-model';

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
    const parsed = AudienciaCopilotInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await analyzeAudiencia(parsed.data);

    return NextResponse.json({
      ok: true,
      analysis: result,
      meta: { provider: 'Google Gemini', model: GEMINI_MODEL_ID },
    });
  } catch (err) {
    console.error('[audiencia-copilot]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
