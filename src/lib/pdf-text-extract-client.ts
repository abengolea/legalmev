import {
  finalizePdfTextExtract,
  type LocalPdfExtractResult,
  PdfExtractError,
} from '@/lib/pdf-text-extract-shared';

/** Extrae texto del PDF en el navegador (paso 1 del import, sin servidor). */
export async function extractTextFromPdfFile(file: File): Promise<LocalPdfExtractResult> {
  const buffer = await file.arrayBuffer();
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const texto = result.text?.trim() ?? '';
    const numPages = Math.max(1, result.total || result.pages?.length || 1);
    return finalizePdfTextExtract(texto, numPages);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export { PdfExtractError };
