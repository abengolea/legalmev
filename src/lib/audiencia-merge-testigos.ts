import { randomUUID } from 'crypto';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaTestigo, RepresentacionCaso } from '@/lib/audiencia-session-types';
import { unionRepreguntas } from '@/lib/audiencia-session-types';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import { inferBandejaDeclarante } from '@/lib/audiencia-copilot-format';

export function normalizeNombreDeclarante(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esRolGenerico(rol: string): boolean {
  const n = rol.trim().toLowerCase();
  return !n || n === 'testigo' || n === 'declarante';
}

function coincideNombreDeclarante(a: string, b: string): boolean {
  const na = normalizeNombreDeclarante(a);
  const nb = normalizeNombreDeclarante(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function indicePorNombre<T extends { nombre: string }>(items: T[], nombre: string): number {
  const n = normalizeNombreDeclarante(nombre);
  if (!n) return -1;

  const exact = items.findIndex((t) => normalizeNombreDeclarante(t.nombre) === n);
  if (exact >= 0) return exact;

  const parciales = items.filter((t) => coincideNombreDeclarante(t.nombre, nombre));
  if (parciales.length === 1) {
    return items.indexOf(parciales[0]);
  }
  return -1;
}

/**
 * Cruza testigos ya cargados con los identificados en un reanálisis.
 * No borra declarantes existentes. Completa contexto/rol y agrega los que falten (hasta el tope).
 */
export function mergeTestigosConIdentificados(params: {
  existing: AudienciaTestigo[];
  identified: ExpedienteAnalysisOutput['testigosIdentificados'];
  declaracionesPrevias: ExpedienteAnalysisOutput['declaracionesPrevias'];
  representacion: RepresentacionCaso;
  tipoFuero?: ExpedienteAnalysisOutput['tipoFuero'];
  maxTestigos?: number;
}): {
  testigos: AudienciaTestigo[];
  agregados: number;
  actualizados: number;
  idsAgregados: string[];
} {
  const next = params.existing.map((t) => ({ ...t }));
  let agregados = 0;
  let actualizados = 0;
  const idsAgregados: string[] = [];
  const max = params.maxTestigos ?? Number.POSITIVE_INFINITY;

  for (const identified of params.identified) {
    const nombre = identified.nombre?.trim();
    if (!nombre) continue;

    const idx = indicePorNombre(next, nombre);
    const testimonioPrevio =
      params.declaracionesPrevias.find(
        (d) => normalizeNombreDeclarante(d.nombre) === normalizeNombreDeclarante(nombre)
      )?.resumen ?? identified.relevancia;

    if (idx >= 0) {
      const current = next[idx];
      const patch: Partial<AudienciaTestigo> = {};
      if (esRolGenerico(current.rol) && identified.rol?.trim()) {
        patch.rol = identified.rol.trim();
      }
      if (!current.contextoDeclarante?.trim() && identified.relevancia?.trim()) {
        patch.contextoDeclarante = identified.relevancia.trim();
      }
      if (!current.testimonioPrevio?.trim() && testimonioPrevio?.trim()) {
        patch.testimonioPrevio = testimonioPrevio.trim();
      }
      if (
        current.bandeja === 'indefinida' &&
        identified.parteProcesal &&
        identified.parteProcesal !== 'desconocido'
      ) {
        patch.bandeja = inferBandejaDeclarante(
          identified.parteProcesal,
          params.representacion,
          params.tipoFuero
        );
      }
      if (Object.keys(patch).length > 0) {
        next[idx] = { ...current, ...patch };
        actualizados += 1;
      }
      continue;
    }

    if (next.length >= max) continue;

    const id = randomUUID();
    next.push({
      id,
      nombre,
      rol: identified.rol?.trim() || 'Testigo',
      bandeja: inferBandejaDeclarante(
        identified.parteProcesal ?? 'desconocido',
        params.representacion,
        params.tipoFuero
      ),
      contextoDeclarante: identified.relevancia?.trim() || '',
      testimonioPrevio: testimonioPrevio?.trim() || '',
      intercambios: [],
      testimonioCerrado: false,
    });
    agregados += 1;
    idsAgregados.push(id);
  }

  return { testigos: next, agregados, actualizados, idsAgregados };
}

const EMPTY_SEEDED_ANALYSIS: AudienciaCopilotOutput = {
  alertas: [],
  repreguntas: [],
  preguntasIneludibles: [],
  contradicciones: [],
  admisiones: [],
  evasivas: [],
  conclusiones: [],
  estrategia: '',
  borradorAlegato: '',
};

/** Carga en el copiloto las preguntas que la IA armó al identificar a cada declarante. */
export function seedAnalisisDesdeIdentificados(params: {
  testigos: AudienciaTestigo[];
  identified: ExpedienteAnalysisOutput['testigosIdentificados'];
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>;
}): Record<string, AudienciaCopilotOutput> {
  const next = { ...params.analysisByTestigoId };

  for (const testigo of params.testigos) {
    const idx = indicePorNombre(params.identified, testigo.nombre);
    const identified = idx >= 0 ? params.identified[idx] : undefined;
    const preguntas = (identified?.preguntasSugeridas ?? [])
      .map((texto) => texto.trim())
      .filter(Boolean);
    if (preguntas.length === 0) continue;

    const incoming = preguntas.map((texto) => ({
      texto,
      destinatario: 'testigo' as const,
    }));
    const prev = next[testigo.id];
    const repreguntas = unionRepreguntas(prev?.repreguntas ?? [], incoming);
    next[testigo.id] = {
      ...(prev ?? EMPTY_SEEDED_ANALYSIS),
      repreguntas,
      preguntasIneludibles:
        prev?.preguntasIneludibles?.length
          ? prev.preguntasIneludibles
          : preguntas.slice(0, 5),
    };
  }

  return next;
}

