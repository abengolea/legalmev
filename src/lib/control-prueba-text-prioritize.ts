/**
 * Prioriza secciones procesales clave en exports MEV largos antes de enviar a la IA.
 * El truncado lineal por inicio descartaba contestación (niega autenticidad) y auto de apertura.
 */

const MAX_CHARS = 350_000;
const HEAD_CHARS = 28_000;

/** Ventanas de contexto alrededor de marcadores procesales (chars antes / después del match). */
const PRUEBA_WINDOWS: { pattern: RegExp; before: number; after: number; label: string }[] = [
  { pattern: /SUMARIO\s+ACTOR\s*:/i, before: 0, after: 12_000, label: 'sumario' },
  { pattern: /OFREZCO\s+PRUEBA|PRUEBA\s+DE\s+LA\s+PARTE/i, before: 2_000, after: 18_000, label: 'ofrecimiento' },
  { pattern: /DOCUMENTAL\s+EN\s+PODER/i, before: 1_500, after: 10_000, label: 'documental_poder' },
  { pattern: /niega\s+la\s+autenticidad|niega\s+documental|expidan\s+sobre\s+su\s+autenticidad|niego\s+por\s+no\s+constarme\s+su\s+autenticidad/i, before: 3_000, after: 14_000, label: 'autenticidad' },
  { pattern: /INFORMATIVA\.|prueba\s+informativa|12\.5\.-?\s*INFORMATIVA/i, before: 1_000, after: 12_000, label: 'informativa' },
  { pattern: /AUTO\s+DE\s+APERTURA\s+A\s+PRUEBA/i, before: 500, after: 35_000, label: 'apertura' },
  { pattern: /DEMANDA\s*[-–]\s*CONTESTA/i, before: 500, after: 45_000, label: 'contestacion' },
];

function isMevExpedienteCompleto(texto: string): boolean {
  return (
    /EXPEDIENTE\s+COMPLETO\s*\(MEV\)/i.test(texto) ||
    /ÍNDICE\s+DEL\s+EXPEDIENTE/i.test(texto) ||
    /nidCausa=\d+/i.test(texto)
  );
}

function isControlPruebaExport(texto: string): boolean {
  return /^Control de Prueba\s*[—–-]\s*LegalMev/im.test(texto.trim());
}

function collectWindows(texto: string): { start: number; end: number; label: string }[] {
  const ranges: { start: number; end: number; label: string }[] = [];
  for (const w of PRUEBA_WINDOWS) {
    const re = new RegExp(w.pattern.source, w.pattern.flags.includes('g') ? w.pattern.flags : w.pattern.flags + 'g');
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(texto)) !== null && count < 6) {
      const start = Math.max(0, m.index - w.before);
      const end = Math.min(texto.length, m.index + m[0].length + w.after);
      ranges.push({ start, end, label: w.label });
      count++;
    }
  }
  return ranges;
}

function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= prev.end + 2_000) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function buildFromRanges(texto: string, ranges: { start: number; end: number }[], budget: number): string {
  const parts: string[] = [];
  let used = 0;
  for (const r of ranges) {
    const chunk = texto.slice(r.start, r.end);
    if (used + chunk.length > budget) {
      const room = budget - used;
      if (room > 2_000) parts.push(chunk.slice(0, room));
      break;
    }
    parts.push(chunk);
    used += chunk.length + 80;
  }
  return parts.join('\n\n--- SECCIÓN PROCESAL ---\n\n');
}

/**
 * Prepara texto para análisis IA: en MEV largos prioriza demanda, contestación, apertura y autenticidad.
 */
export function prioritizeTextoForPruebaAnalysis(texto: string, maxChars = MAX_CHARS): string {
  const trimmed = texto.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= maxChars) return trimmed;

  if (isControlPruebaExport(trimmed)) {
    return trimmed.slice(0, maxChars);
  }

  if (!isMevExpedienteCompleto(trimmed)) {
    return `${trimmed.slice(0, maxChars)}\n\n[... expediente truncado por tamaño ...]`;
  }

  const head = trimmed.slice(0, Math.min(HEAD_CHARS, trimmed.length));
  const windows = collectWindows(trimmed);
  const merged = mergeRanges(windows);
  const bodyBudget = maxChars - head.length - 200;
  const body = buildFromRanges(trimmed, merged, bodyBudget);

  const result = `${head}\n\n--- EXTRACTO PRIORIZADO (demanda / contestación / apertura / autenticidad) ---\n\n${body}`;
  if (result.length <= maxChars) return result;
  return `${result.slice(0, maxChars)}\n\n[... expediente truncado tras priorización ...]`;
}

export function detectImportPdfKind(texto: string): 'mev_expediente' | 'control_prueba_export' | 'otro' {
  const t = texto.trim();
  if (isControlPruebaExport(t)) return 'control_prueba_export';
  if (isMevExpedienteCompleto(t)) return 'mev_expediente';
  return 'otro';
}
