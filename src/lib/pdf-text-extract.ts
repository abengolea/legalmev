import { PDFParse } from 'pdf-parse';
import {
  finalizePdfTextExtract,
  PDF_EXTRACT_CODES,
  PdfExtractError,
  type LocalPdfExtractResult,
} from '@/lib/pdf-text-extract-shared';

export {
  PDF_EXTRACT_CODES,
  PdfExtractError,
  SCANNED_PDF_USER_MESSAGE,
  EMPTY_PDF_USER_MESSAGE,
  isLikelyScannedPdf,
  type LocalPdfExtractResult,
  type PdfExtractCode,
} from '@/lib/pdf-text-extract-shared';

/** Extrae texto del PDF en el servidor, sin usar IA. */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<LocalPdfExtractResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const texto = result.text?.trim() ?? '';
    const numPages = Math.max(1, result.total || result.pages?.length || 1);
    return finalizePdfTextExtract(texto, numPages);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
