/**
 * Redacta identificadores sensibles de textos de expedientes.
 * Conserva nombres de personas; elimina DNI/CUIT, contactos, matrículas y domicilios tipificados.
 */

export const REDACT_PLACEHOLDER = {
  dni: '[DNI_REDACTADO]',
  cuit: '[CUIT_REDACTADO]',
  email: '[EMAIL_REDACTADO]',
  telefono: '[TELEFONO_REDACTADO]',
  matricula: '[MATRICULA_REDACTADA]',
  domicilio: '[DOMICILIO_REDACTADO]',
} as const;

/** DNI / documento de identidad (con o sin puntos). */
const DNI_LABELED =
  /\b(?:D\.?\s*N\.?\s*I\.?|Documento\s+Nacional\s+de\s+Identidad|Doc(?:umento)?\.?\s*(?:n[°ºo.]?\s*)?|LE|LC)\s*[:\-º°]?\s*N?°?\s*[\d][\d.\s]{5,14}\d\b/gi;

/** Número de documento suelto tras "DNI" ya cubierto; CUIL/CUIT etiquetados. */
const CUIT_LABELED =
  /\b(?:C\.?\s*U\.?\s*I\.?\s*T\.?|C\.?\s*U\.?\s*I\.?\s*L\.?|CUIT|CUIL)\s*[:\-º°]?\s*N?°?\s*\d{2}[\-\s]?\d{7,8}[\-\s]?\d\b/gi;

/** Patrón XX-XXXXXXXX-X típico de CUIT/CUIL. */
const CUIT_NUMBER = /\b\d{2}-\d{8}-\d\b/g;

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Teléfonos AR frecuentes (evita años tipo 2024). */
const TELEFONO =
  /(?:\+54\s*)?(?:\(?0?(?:11|15|2\d{2}|3\d{2})\)?[\s\-]*)?(?:15[\s\-]*)?\d{3,4}[\s\-]?\d{4}\b/g;

/** Matrícula profesional / T° F° de colegios (evita “Tomo de la demanda”). */
const MATRICULA =
  /\b(?:Matr[íi]cula|Mat\.?)\s*(?:N[°º.]?\s*)?[:\-]?\s*[A-Z0-9.\-\/]{1,24}\b/gi;
const TOMO_FOLIO =
  /\bT[°º]\.?\s*[IVXLCDM0-9]{1,12}\s*F[°º]\.?\s*[0-9]{1,6}\b/gi;

/**
 * Frases de domicilio: "domicilio en …", "sito en …", "reside en …"
 * hasta el siguiente punto, punto y coma o salto de línea (máx. ~120 chars).
 */
const DOMICILIO_FRASE =
  /\b(?:con\s+)?(?:domicilio|reside|residencia|sito|ubicad[oa]|constituid[oa]\s+domicilio)(?:\s+(?:real|legal|constituido|especial|procesal))?\s+(?:en|en\s+la|en\s+el|en\s+los|en\s+las|de|del)?\s*[^.;\n]{3,120}/gi;

/** Calle / Av. + número. */
const CALLE_NUMERO =
  /\b(?:Calle|Av(?:enida)?\.?|Pasaje|Pje\.?|Ruta|Diagonal|Diag\.?)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.'\-]{2,60}?(?:N[°º.]?\s*|nro\.?\s*|núm(?:ero)?\.?\s*|n°\s*)?\d{1,5}(?:\s*(?:piso|dto|depto|departamento|oficina|of\.?)\s*[\w\-\/]+)?/gi;

/** Código postal. */
const CODIGO_POSTAL = /\b(?:C\.?\s*P\.?|C[oó]digo\s+Postal)\s*[:\-]?\s*[A-Z]?\d{4}(?:[A-Z]{3})?\b/gi;

function applyAll(
  text: string,
  pattern: RegExp,
  replacement: string | ((substring: string, ...args: string[]) => string),
): string {
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement as string);
}

/**
 * Devuelve el texto con identificadores sensibles reemplazados por placeholders.
 * Idempotente: re-aplicar sobre texto ya redactado no cambia el resultado de forma útil.
 */
export function redactSensitiveIdentifiers(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let out = text;

  out = applyAll(out, EMAIL, REDACT_PLACEHOLDER.email);
  out = applyAll(out, CUIT_LABELED, REDACT_PLACEHOLDER.cuit);
  out = applyAll(out, CUIT_NUMBER, REDACT_PLACEHOLDER.cuit);
  out = applyAll(out, DNI_LABELED, REDACT_PLACEHOLDER.dni);
  out = applyAll(out, MATRICULA, REDACT_PLACEHOLDER.matricula);
  out = applyAll(out, TOMO_FOLIO, REDACT_PLACEHOLDER.matricula);
  out = applyAll(out, DOMICILIO_FRASE, REDACT_PLACEHOLDER.domicilio);
  out = applyAll(out, CALLE_NUMERO, REDACT_PLACEHOLDER.domicilio);
  out = applyAll(out, CODIGO_POSTAL, REDACT_PLACEHOLDER.domicilio);

  // Teléfonos al final: más propensos a falsos positivos; ya redujimos contexto.
  out = applyAll(out, TELEFONO, (match) => {
    const digits = match.replace(/\D/g, '');
    // Evitar códigos de expediente cortos / años
    if (digits.length < 8 || digits.length > 15) return match;
    if (/^20(1[5-9]|2[0-9])$/.test(digits)) return match;
    return REDACT_PLACEHOLDER.telefono;
  });

  return out;
}
