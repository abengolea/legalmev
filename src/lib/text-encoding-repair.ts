/**
 * Repara texto en español afectado por:
 * - mojibake UTF-8 leído como Latin-1/Windows-1252 (p. ej. "Ã‘" → "Ñ")
 * - carácter de reemplazo U+FFFD de extracción PDF sin ToUnicode (p. ej. "DA�OS" → "DAÑOS")
 */

const MOJIBAKE_HINT = /Ã.|Â.|â€.|ï¿½/;

function spanishSignalScore(text: string): number {
  const hits = text.match(/[áéíóúñÁÉÍÓÚÑüÜ]/g);
  const bad = text.match(/\uFFFD|ï¿½|Ã.|Â./g);
  return (hits?.length ?? 0) * 2 - (bad?.length ?? 0);
}

function replacePreservingCase(text: string, pattern: RegExp, canonicalUpper: string): string {
  return text.replace(pattern, (match) => {
    if (match === match.toUpperCase()) return canonicalUpper;
    if (match === match.toLowerCase()) return canonicalUpper.toLowerCase();
    return canonicalUpper.charAt(0) + canonicalUpper.slice(1).toLowerCase();
  });
}

/** Intenta re-decodificar mojibake típico Latin-1 ← UTF-8. */
function tryFixLatin1AsUtf8(text: string): string {
  if (!MOJIBAKE_HINT.test(text)) return text;
  try {
    const bytes = Uint8Array.from({ length: text.length }, (_, i) => text.charCodeAt(i) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded || decoded.includes('\uFFFD')) return text;
    if (spanishSignalScore(decoded) >= spanishSignalScore(text)) return decoded;
  } catch {
    // keep original
  }
  return text;
}

/**
 * Palabras legales frecuentes donde la Ñ se perdió (/ToUnicode ausente en el PDF).
 * Solo aplica cuando hay � o "?" en el lugar de la Ñ.
 */
function repairLostEnnye(text: string): string {
  let out = text.replace(/ï¿½/g, '\uFFFD');

  const pairs: Array<[RegExp, string]> = [
    [/\bDA(?:\uFFFD|\?)OS\b/gi, 'DAÑOS'],
    [/\bA(?:\uFFFD|\?)OS\b/gi, 'AÑOS'],
    [/\bNI(?:\uFFFD|\?)OS\b/gi, 'NIÑOS'],
    [/\bNI(?:\uFFFD|\?)AS\b/gi, 'NIÑAS'],
    [/\bNI(?:\uFFFD|\?)O\b/gi, 'NIÑO'],
    [/\bNI(?:\uFFFD|\?)A\b/gi, 'NIÑA'],
    [/\bSE(?:\uFFFD|\?)ORES\b/gi, 'SEÑORES'],
    [/\bSE(?:\uFFFD|\?)ORAS\b/gi, 'SEÑORAS'],
    [/\bSE(?:\uFFFD|\?)OR\b/gi, 'SEÑOR'],
    [/\bSE(?:\uFFFD|\?)ORA\b/gi, 'SEÑORA'],
    [/\bCOMPA(?:\uFFFD|\?)[IÍ]A\b/gi, 'COMPAÑÍA'],
    [/\bMONTA(?:\uFFFD|\?)A\b/gi, 'MONTAÑA'],
    [/\bCAMP(?:\uFFFD|\?)A\b/gi, 'CAMPAÑA'],
    [/\bENSE(?:\uFFFD|\?)ANZA\b/gi, 'ENSEÑANZA'],
    [/\bDISE(?:\uFFFD|\?)O\b/gi, 'DISEÑO'],
    [/\bTAMBI(?:\uFFFD|\?)N\b/gi, 'TAMBIÉN'],
  ];

  for (const [pattern, canonical] of pairs) {
    out = replacePreservingCase(out, pattern, canonical);
  }

  return out;
}

/** Normaliza y repara encoding de texto jurídico en español. */
export function repairSpanishTextEncoding(input: string): string {
  if (!input) return input;
  let text = input.normalize('NFC');
  text = tryFixLatin1AsUtf8(text);
  text = repairLostEnnye(text);
  return text.normalize('NFC');
}
