import {
  EMPTY_PDF_USER_MESSAGE,
  extractTextFromPdfBuffer,
  PdfExtractError,
  SCANNED_PDF_USER_MESSAGE,
} from '@/lib/pdf-text-extract';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

export type ExtractAudienciaDocumentResult = {
  texto: string;
  mimeType: string;
};

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i).toLowerCase() : '';
}

function isPdf(fileName: string, mimeType: string): boolean {
  return mimeType === 'application/pdf' || extensionOf(fileName) === '.pdf';
}

function isPlainText(fileName: string, mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  return TEXT_EXTENSIONS.has(extensionOf(fileName));
}

/** Extrae texto de PDF (local) o archivos de texto plano. */
export async function extractTextFromAudienciaDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractAudienciaDocumentResult> {
  if (isPlainText(fileName, mimeType)) {
    const texto = buffer.toString('utf-8').trim();
    if (!texto) throw new PdfExtractError(EMPTY_PDF_USER_MESSAGE, 'EMPTY_PDF');
    return { texto, mimeType: mimeType || 'text/plain' };
  }

  if (isPdf(fileName, mimeType)) {
    const { texto } = await extractTextFromPdfBuffer(buffer);
    return { texto, mimeType: 'application/pdf' };
  }

  throw new PdfExtractError(
    'Formato no soportado. Subí PDF con texto seleccionable o archivo de texto (.txt, .md, .csv).',
    'EMPTY_PDF'
  );
}

export { PdfExtractError, PDF_EXTRACT_CODES, SCANNED_PDF_USER_MESSAGE } from '@/lib/pdf-text-extract';
