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

type PdfParseCtor = typeof import('pdf-parse').PDFParse;
type CanvasFactoryType = NonNullable<ConstructorParameters<PdfParseCtor>[0]['CanvasFactory']>;

let pdfParseCtor: PdfParseCtor | null = null;
let canvasFactory: CanvasFactoryType | null = null;

async function loadPdfParseServer(): Promise<{
  PDFParse: PdfParseCtor;
  CanvasFactory: CanvasFactoryType;
}> {
  if (!pdfParseCtor || !canvasFactory) {
    const worker = await import('pdf-parse/worker');
    const pdfParse = await import('pdf-parse');
    pdfParseCtor = pdfParse.PDFParse;
    canvasFactory = worker.CanvasFactory;
  }
  return { PDFParse: pdfParseCtor, CanvasFactory: canvasFactory };
}

/** Extrae texto del PDF en el servidor, sin usar IA. */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<LocalPdfExtractResult> {
  const { PDFParse, CanvasFactory } = await loadPdfParseServer();
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    const texto = result.text?.trim() ?? '';
    const numPages = Math.max(1, result.total || result.pages?.length || 1);
    return finalizePdfTextExtract(texto, numPages);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
