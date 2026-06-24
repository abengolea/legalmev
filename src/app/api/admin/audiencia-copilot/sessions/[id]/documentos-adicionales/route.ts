import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import {
  extractTextFromAudienciaDocument,
  PdfExtractError,
} from '@/lib/audiencia-document-extract';
import {
  countAudienciaSessionUsage,
  getCopilotLimitsForContext,
  isAudienciaSessionPaid,
  trialLimitError,
} from '@/lib/audiencia-copilot-limits';
import type { DocumentoAdicionalAudiencia } from '@/lib/audiencia-session-types';

const COLLECTION = 'audiencia_sessions';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DOCS_PER_SESSION = 10;
const MAX_TEXTO_POR_DOC = 80_000;

export const maxDuration = 120;

async function readUploadFile(file: FormDataEntryValue | null): Promise<{
  buffer: Buffer;
  name: string;
  mimeType: string;
} | null> {
  if (!file || typeof file === 'string') return null;
  const name = 'name' in file && typeof file.name === 'string' ? file.name : 'documento.pdf';
  const mimeType = 'type' in file && typeof file.type === 'string' ? file.type : '';
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return null;
  return { buffer, name, mimeType };
}

/** Sube un documento adicional (PDF o texto) para contexto de alegatos. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

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

    const existing = (data.documentosAdicionales as DocumentoAdicionalAudiencia[]) || [];
    const limits = getCopilotLimitsForContext(auth.unlimited, isAudienciaSessionPaid(data));
    if (limits) {
      const usage = countAudienciaSessionUsage({ documentosAdicionales: existing });
      const docErr = trialLimitError(limits, usage, 'add_documento');
      if (docErr) {
        return NextResponse.json({ ok: false, error: docErr, code: 'TRIAL_LIMIT' }, { status: 403 });
      }
    }

    if (existing.length >= MAX_DOCS_PER_SESSION) {
      return NextResponse.json(
        { ok: false, error: `Máximo ${MAX_DOCS_PER_SESSION} documentos adicionales por audiencia` },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const upload = await readUploadFile(form.get('file'));
    if (!upload) {
      return NextResponse.json({ ok: false, error: 'Falta archivo' }, { status: 400 });
    }

    if (upload.buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Archivo demasiado grande (máx. 10 MB)' },
        { status: 400 }
      );
    }

    const descripcionRaw = form.get('descripcion');
    const descripcion =
      typeof descripcionRaw === 'string' ? descripcionRaw.trim().slice(0, 200) : '';

    const extracted = await extractTextFromAudienciaDocument(
      upload.buffer,
      upload.name,
      upload.mimeType
    );

    const texto = extracted.texto.slice(0, MAX_TEXTO_POR_DOC);
    const now = new Date().toISOString();
    const documento: DocumentoAdicionalAudiencia = {
      id: randomUUID(),
      fileName: upload.name,
      descripcion,
      texto,
      mimeType: extracted.mimeType,
      textoLength: texto.length,
      uploadedAt: now,
    };

    const documentosAdicionales = [...existing, documento];

    await ref.update({
      documentosAdicionales,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      documento,
      documentosAdicionales,
    });
  } catch (err) {
    console.error('[audiencia-copilot/sessions/documentos-adicionales POST]', err);
    if (err instanceof PdfExtractError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: 422 }
      );
    }
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
