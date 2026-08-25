import { randomUUID } from 'crypto';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaTestigo, RepresentacionCaso } from '@/lib/audiencia-session-types';
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

function indiceTestigoPorNombre(existing: AudienciaTestigo[], nombre: string): number {
  const n = normalizeNombreDeclarante(nombre);
  if (!n) return -1;

  const exact = existing.findIndex((t) => normalizeNombreDeclarante(t.nombre) === n);
  if (exact >= 0) return exact;

  const parciales = existing.filter((t) => {
    const tn = normalizeNombreDeclarante(t.nombre);
    if (!tn) return false;
    return tn.includes(n) || n.includes(tn);
  });
  if (parciales.length === 1) {
    return existing.indexOf(parciales[0]);
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
}): { testigos: AudienciaTestigo[]; agregados: number; actualizados: number } {
  const next = params.existing.map((t) => ({ ...t }));
  let agregados = 0;
  let actualizados = 0;
  const max = params.maxTestigos ?? Number.POSITIVE_INFINITY;

  for (const identified of params.identified) {
    const nombre = identified.nombre?.trim();
    if (!nombre) continue;

    const idx = indiceTestigoPorNombre(next, nombre);
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

    next.push({
      id: randomUUID(),
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
  }

  return { testigos: next, agregados, actualizados };
}
