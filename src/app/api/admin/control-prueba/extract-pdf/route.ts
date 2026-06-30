import { NextRequest, NextResponse } from 'next/server';
import { requireControlPruebaSuperAdmin } from '@/lib/api-auth';
import {
  extractMetadataFromExpedienteText,
  extractMetadataFromFilename,
  mergeMetadataLocal,
  truncateTextoForAnalysis,
} from '@/lib/control-prueba';
import {
  extractTextFromPdfBuffer,
  PdfExtractError,
  PDF_EXTRACT_CODES,
} from '@/lib/pdf-text-extract';

const MAX_PDF_BYTES = 15 * 1024 * 1024;

export const maxDuration = 60;

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

/**
 * POST /api/admin/control-prueba/extract-pdf
 * Paso 1: extrae texto del PDF localmente (sin IA).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const form = await request.formData();
    const upload = await readUploadFile(form.get('file'));
    if (!upload) {
      return NextResponse.json({ ok: false, error: 'Falta archivo PDF' }, { status: 400 });
    }

    if (upload.buffer.length > MAX_PDF_BYTES) {
      return NextResponse.json({ ok: false, error: 'PDF demasiado grande (máx. 15 MB)' }, { status: 400 });
    }

    const { texto: textoCompleto, numPages, charsPerPage } = await extractTextFromPdfBuffer(upload.buffer);
    const texto = truncateTextoForAnalysis(textoCompleto);
    const metadata = mergeMetadataLocal(
      extractMetadataFromFilename(upload.name),
      extractMetadataFromExpedienteText(textoCompleto),
    );

    return NextResponse.json({
      ok: true,
      step: 'extracted',
      pdfFileName: upload.name,
      numPages,
      charsPerPage,
      textoLength: texto.length,
      textoPreview: texto.slice(0, 600),
      texto,
      metadata,
    });
  } catch (err) {
    console.error('[control-prueba/extract-pdf]', err);
    if (err instanceof PdfExtractError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno', code: PDF_EXTRACT_CODES.EMPTY_PDF },
      { status: 500 },
    );
  }
}
