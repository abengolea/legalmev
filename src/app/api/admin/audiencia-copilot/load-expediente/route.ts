import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import {
  canCreateAudienciaSession,
  type AudienciaCopilotTrial,
} from '@/lib/audiencia-copilot-access';
import { requireGoogleGenAiApiKey } from '@/lib/google-ai-key';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import {
  normalizeGeminiSdkUsage,
  normalizeTokenUsage,
  sumTokenUsage,
} from '@/lib/ai-token-usage';
import type { AudienciaTestigo } from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';

const COLLECTION = 'audiencia_sessions';
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_TEXTO_GUARDADO = 400_000;

export const maxDuration = 120;

async function readUploadFile(file: FormDataEntryValue | null): Promise<{
  buffer: Buffer;
  name: string;
} | null> {
  if (!file || typeof file === 'string') return null;
  const name = 'name' in file && typeof file.name === 'string' ? file.name : 'expediente.pdf';
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return null;
  return { buffer, name };
}

/** Paso 1: extrae texto del PDF y crea sesión en Firestore. */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(auth.uid).get();
    const userData = userSnap.data() ?? {};
    const copilotUser = {
      email: userData.email as string | undefined,
      audienciaCopilotTrial: userData.audienciaCopilotTrial as AudienciaCopilotTrial | undefined,
    };

    if (!canCreateAudienciaSession(copilotUser)) {
      const limit = copilotUser.audienciaCopilotTrial?.limit ?? 0;
      return NextResponse.json(
        {
          ok: false,
          error: `Alcanzaste el límite de ${limit} audiencias de prueba. Contactá a LegalMev para ampliar el acceso.`,
        },
        { status: 403 }
      );
    }

    const apiKey = requireGoogleGenAiApiKey();
    const form = await request.formData();
    const upload = await readUploadFile(form.get('file'));

    if (!upload) {
      return NextResponse.json({ ok: false, error: 'Falta archivo PDF' }, { status: 400 });
    }

    if (upload.buffer.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'PDF demasiado grande (máx. 15 MB)' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_ID });

    const extractResult = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: upload.buffer.toString('base64'),
        },
      },
      `Extraé el texto completo de este expediente judicial exportado en PDF.
Conservá la estructura por actuaciones si es posible.
Solo el texto extraído, sin comentarios ni resúmenes.`,
    ]);

    const texto = extractResult.response.text()?.trim();
    if (!texto) {
      return NextResponse.json(
        { ok: false, error: 'Gemini no devolvió texto del PDF' },
        { status: 422 }
      );
    }

    const extractUsage = normalizeGeminiSdkUsage(extractResult.response.usageMetadata);
    const tokenUsage = {
      ...extractUsage,
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: new Date().toISOString(),
    };

    const now = new Date().toISOString();
    const titulo = upload.name.replace(/\.pdf$/i, '') || 'Audiencia';

    const sessionRef = adminDb.collection(COLLECTION).doc();

    await sessionRef.set({
      userId: auth.uid,
      titulo,
      pdfFileName: upload.name,
      expedienteTexto: texto.slice(0, MAX_TEXTO_GUARDADO),
      analysisStatus: 'pending',
      testigos: [],
      testigoActivoId: null,
      analysisByTestigoId: {},
      preguntasATodos: [],
      representacion: { ...EMPTY_REPRESENTACION },
      tokenUsage,
      createdAt: now,
      updatedAt: now,
    });

    if (!auth.unlimited) {
      await adminDb.collection('users').doc(auth.uid).update({
        'audienciaCopilotTrial.used': FieldValue.increment(1),
      });
    }

    return NextResponse.json({
      ok: true,
      sessionId: sessionRef.id,
      titulo,
      textoLength: texto.length,
      pdfSizeKb: Math.round(upload.buffer.length / 1024),
      step: 'extracted',
      meta: {
        provider: 'Google Gemini',
        model: GEMINI_MODEL_ID,
        fileName: upload.name,
        usage: extractUsage,
      },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot/load-expediente]', err);
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message.includes('GOOGLE_GENAI_API_KEY') ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
