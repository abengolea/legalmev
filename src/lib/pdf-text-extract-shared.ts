import { repairSpanishTextEncoding } from '@/lib/text-encoding-repair';

export const PDF_EXTRACT_CODES = {
  SCANNED_PDF: 'SCANNED_PDF',
  EMPTY_PDF: 'EMPTY_PDF',
} as const;

export type PdfExtractCode = (typeof PDF_EXTRACT_CODES)[keyof typeof PDF_EXTRACT_CODES];

export class PdfExtractError extends Error {
  readonly code: PdfExtractCode;

  constructor(message: string, code: PdfExtractCode) {
    super(message);
    this.name = 'PdfExtractError';
    this.code = code;
  }
}

export type LocalPdfExtractResult = {
  texto: string;
  numPages: number;
  charsPerPage: number;
};

const MIN_TOTAL_CHARS = 120;
const MIN_MEANINGFUL_CHARS = 80;
const MIN_CHARS_PER_PAGE = 45;
const MIN_MEANINGFUL_PER_PAGE = 35;

function meaningfulCharCount(text: string): number {
  return (text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑüÜ0-9]/g) ?? []).length;
}

/** Heurística: PDF escaneado o sin capa de texto útil. */
export function isLikelyScannedPdf(texto: string, numPages: number): boolean {
  const trimmed = texto.replace(/\s+/g, ' ').trim();
  const pages = Math.max(1, numPages);
  const meaningful = meaningfulCharCount(trimmed);

  if (trimmed.length < MIN_TOTAL_CHARS) return true;
  if (meaningful < MIN_MEANINGFUL_CHARS) return true;
  if (trimmed.length / pages < MIN_CHARS_PER_PAGE) return true;
  if (meaningful / pages < MIN_MEANINGFUL_PER_PAGE) return true;

  return false;
}

export const SCANNED_PDF_USER_MESSAGE =
  'No se pudo leer suficiente texto del PDF. Si es un export de LegalMev/MEV, probá de nuevo tras reiniciar el servidor de desarrollo. Si es una fotocopia escaneada, exportá el expediente con texto desde el sistema judicial.';

export const EMPTY_PDF_USER_MESSAGE =
  'No se pudo leer texto del PDF. Verificá que el archivo no esté corrupto o protegido con contraseña.';

export function finalizePdfTextExtract(texto: string, numPages: number): LocalPdfExtractResult {
  const pages = Math.max(1, numPages);
  const repaired = repairSpanishTextEncoding(texto.trim());
  if (!repaired) {
    throw new PdfExtractError(EMPTY_PDF_USER_MESSAGE, PDF_EXTRACT_CODES.EMPTY_PDF);
  }
  if (isLikelyScannedPdf(repaired, pages)) {
    throw new PdfExtractError(SCANNED_PDF_USER_MESSAGE, PDF_EXTRACT_CODES.SCANNED_PDF);
  }
  return {
    texto: repaired,
    numPages: pages,
    charsPerPage: Math.round(repaired.length / pages),
  };
}
