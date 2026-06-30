/**
 * Plazos y días hábiles judiciales (Argentina / SCBA).
 * Excluye fines de semana, feriados nacionales fijos y ferias judiciales
 * (verano: enero completo; invierno: ~14 días en julio).
 *
 * OJO: las fechas exactas de la feria de invierno las fija cada año la acordada
 * de la Corte/Cámara correspondiente y varían por jurisdicción (SCBA, PJN, otras
 * provincias). Los rangos de abajo son una aproximación razonable, no una fuente
 * oficial — para causas con vencimientos críticos, verificar la acordada del año
 * y fuero correspondiente.
 */

const FERIA_VERANO_INICIO = { mes: 0, dia: 1 }; // enero (0-indexed)
const FERIA_VERANO_FIN = { mes: 0, dia: 31 };
const FERIA_INVIERNO_INICIO = { mes: 6, dia: 1 }; // julio (0-indexed)
const FERIA_INVIERNO_FIN = { mes: 6, dia: 14 };

/** Feriados nacionales inamovibles + trasladables frecuentes (aprox.). Ampliar por año si hace falta. */
function feriadosNacionales(year: number): Set<string> {
  const f = (m: number, d: number) => toIso(new Date(year, m - 1, d));
  const set = new Set([
    f(1, 1),
    f(3, 24),
    f(4, 2),
    f(5, 1),
    f(5, 25),
    f(6, 17),
    f(6, 20),
    f(7, 9),
    f(8, 17),
    f(10, 12),
    f(11, 20),
    f(12, 8),
    f(12, 25),
  ]);
  // Semana Santa aproximada (Viernes Santo) — años 2025-2027
  const viernesSanto: Record<number, string> = {
    2025: f(4, 18),
    2026: f(4, 3),
    2027: f(3, 26),
  };
  if (viernesSanto[year]) set.add(viernesSanto[year]);
  return set;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isFeriaJudicial(d: Date): boolean {
  const enVerano =
    d.getMonth() === FERIA_VERANO_INICIO.mes &&
    d.getDate() >= FERIA_VERANO_INICIO.dia &&
    d.getDate() <= FERIA_VERANO_FIN.dia;
  const enInvierno =
    d.getMonth() === FERIA_INVIERNO_INICIO.mes &&
    d.getDate() >= FERIA_INVIERNO_INICIO.dia &&
    d.getDate() <= FERIA_INVIERNO_FIN.dia;
  return enVerano || enInvierno;
}

export function isDiaHabil(iso: string): boolean {
  const d = parseIso(iso);
  if (!d) return false;
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  if (isFeriaJudicial(d)) return false;
  if (feriadosNacionales(d.getFullYear()).has(iso)) return false;
  return true;
}

/** Días hábiles desde hoy hasta la fecha límite (negativo si venció). */
export function diasHabilesHasta(fechaLimiteIso: string, desde = new Date()): number | null {
  const limite = parseIso(fechaLimiteIso);
  if (!limite) return null;

  const hoy = new Date(desde);
  hoy.setHours(12, 0, 0, 0);
  limite.setHours(12, 0, 0, 0);

  if (toIso(hoy) === toIso(limite)) return 0;

  const forward = limite > hoy;
  let cursor = new Date(hoy);
  let count = 0;

  if (forward) {
    while (toIso(cursor) < toIso(limite)) {
      cursor.setDate(cursor.getDate() + 1);
      if (isDiaHabil(toIso(cursor))) count += 1;
    }
    return count;
  }

  while (toIso(cursor) > toIso(limite)) {
    cursor.setDate(cursor.getDate() - 1);
    if (isDiaHabil(toIso(cursor))) count -= 1;
  }
  return count;
}

/** Suma N días hábiles a una fecha ISO. */
export function sumarDiasHabiles(desdeIso: string, dias: number): string | null {
  const start = parseIso(desdeIso);
  if (!start || dias < 0) return null;
  let restantes = dias;
  const cursor = new Date(start);
  while (restantes > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isDiaHabil(toIso(cursor))) restantes -= 1;
  }
  return toIso(cursor);
}

/** Resta N días hábiles a una fecha ISO. */
export function restarDiasHabiles(desdeIso: string, dias: number): string | null {
  const start = parseIso(desdeIso);
  if (!start || dias < 0) return null;
  let restantes = dias;
  const cursor = new Date(start);
  while (restantes > 0) {
    cursor.setDate(cursor.getDate() - 1);
    if (isDiaHabil(toIso(cursor))) restantes -= 1;
  }
  return toIso(cursor);
}

/** Plazos orientativos CPCC Buenos Aires (Ley 7425) en días hábiles. */
export function plazoSugeridoDiasHabiles(tipo: string): number | null {
  switch (tipo) {
    case 'pericial':
      return 60;
    case 'informativa':
      return 30;
    case 'confesional':
      return 20;
    default:
      return null;
  }
}

export function etiquetaDiasHabiles(dias: number | null): string {
  if (dias === null) return '';
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} hábil${Math.abs(dias) === 1 ? '' : 'es'}`;
  if (dias === 0) return 'Vence hoy';
  return `${dias} día${dias === 1 ? '' : 's'} hábil${dias === 1 ? '' : 'es'}`;
}
