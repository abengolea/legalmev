import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import {
  AUDIENCIA_COPILOT_TRIAL_SESSIONS,
  canCreateAudienciaSession,
  type AudienciaCopilotTrial,
} from '@/lib/audiencia-copilot-access';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { EMPTY_TOKEN_USAGE } from '@/lib/ai-token-usage';
import {
  extractTextFromPdfBuffer,
  PdfExtractError,
  PDF_EXTRACT_CODES,
} from '@/lib/pdf-text-extract';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';

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

/** Paso 1: extrae texto del PDF localmente y crea sesión en Firestore. */
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

    const { texto: textoCompleto, numPages, charsPerPage } = await extractTextFromPdfBuffer(
      upload.buffer
    );
    const texto = redactSensitiveIdentifiers(textoCompleto).slice(0, MAX_TEXTO_GUARDADO);

    const now = new Date().toISOString();
    const titulo = upload.name.replace(/\.pdf$/i, '') || 'Audiencia';
    const tokenUsage = {
      ...EMPTY_TOKEN_USAGE,
      model: GEMINI_MODEL_ID,
      lastUpdatedAt: now,
    };

    const sessionRef = adminDb.collection(COLLECTION).doc();

    await sessionRef.set({
      userId: auth.uid,
      titulo,
      pdfFileName: upload.name,
      expedienteTexto: texto,
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
      const existingTrial = copilotUser.audienciaCopilotTrial;
      if (!existingTrial || typeof existingTrial.limit !== 'number') {
        await adminDb.collection('users').doc(auth.uid).set(
          {
            audienciaCopilotTrial: {
              limit: AUDIENCIA_COPILOT_TRIAL_SESSIONS,
              used: 1,
              grantedAt: now,
              grantedBy: 'auto',
            },
            updatedAt: now,
          },
          { merge: true }
        );
      } else {
        await adminDb.collection('users').doc(auth.uid).update({
          'audienciaCopilotTrial.used': FieldValue.increment(1),
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      sessionId: sessionRef.id,
      titulo,
      textoLength: texto.length,
      pdfSizeKb: Math.round(upload.buffer.length / 1024),
      numPages,
      charsPerPage,
      step: 'extracted',
      meta: {
        extractMethod: 'local',
        fileName: upload.name,
      },
      tokenUsage,
    });
  } catch (err) {
    console.error('[audiencia-copilot/load-expediente]', err);
    if (err instanceof PdfExtractError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: 422 }
      );
    }
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json(
      { ok: false, error: message, code: PDF_EXTRACT_CODES.EMPTY_PDF },
      { status: 500 }
    );
  }
}
