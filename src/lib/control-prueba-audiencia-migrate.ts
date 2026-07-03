import type { ControlPruebaItem } from '@/types/control-prueba';
import { resolveCategoria } from '@/lib/control-prueba';
import { audienciaEstaFijadaParaCedula, requiereAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import {
  buildEventoAudienciaPrueba,
  esEventoAudienciaPrueba,
  eventoAudienciaActivoDePrueba,
  eventosAudienciaDePrueba,
  ROL_AUDIENCIA_PRUEBA,
  sincronizarEstadoPruebaConEventos,
} from '@/lib/control-prueba-audiencia-evento';

function esPruebaAudienciaOfrecida(item: ControlPruebaItem): boolean {
  return requiereAudienciaPrueba(item.tipo);
}

/** Descripción genérica de eventos hijos (no prueba ofrecida real). */
function esDescripcionEventoAudiencia(descripcion: string): boolean {
  return /^Audiencia (confesional|testimonial)\b/i.test(descripcion.trim());
}

function esConfesionalFantasmaEnPrueba(item: ControlPruebaItem): boolean {
  if (resolveCategoria(item) !== 'prueba') return false;
  if (!esPruebaAudienciaOfrecida(item)) return false;
  if (item.vinculo?.rol === ROL_AUDIENCIA_PRUEBA) return true;
  return esDescripcionEventoAudiencia(item.descripcion);
}

function esPruebaAudienciaReal(item: ControlPruebaItem): boolean {
  if (resolveCategoria(item) !== 'prueba') return false;
  if (!esPruebaAudienciaOfrecida(item)) return false;
  if (esConfesionalFantasmaEnPrueba(item)) return false;
  return true;
}

/** Evento hijo de confesional/testimonial (vinculado o duplicado legacy). */
function esEventoAudienciaCandidato(item: ControlPruebaItem): boolean {
  if (resolveCategoria(item) !== 'audiencia') return false;
  if (!esPruebaAudienciaOfrecida(item)) return false;
  if (esEventoAudienciaPrueba(item)) return true;
  return esDescripcionEventoAudiencia(item.descripcion);
}

function findPruebaMadreParaFantasma(
  items: ControlPruebaItem[],
  fantasma: ControlPruebaItem,
): ControlPruebaItem | undefined {
  const parentId = fantasma.vinculo?.parentItemId;
  if (parentId) {
    const padre = items.find((i) => i.id === parentId);
    if (padre && esPruebaAudienciaReal(padre)) return padre;
  }

  const parte = fantasma.ofrecidaPor ?? 'actor';
  const candidatas = items.filter(
    (i) =>
      esPruebaAudienciaReal(i) &&
      i.tipo === fantasma.tipo &&
      (i.ofrecidaPor ?? 'actor') === parte,
  );
  if (candidatas.length === 1) return candidatas[0];
  return candidatas.sort((a, b) => a.orden - b.orden)[0];
}

function resolverPruebaMadreId(items: ControlPruebaItem[], evento: ControlPruebaItem): string | null {
  const parentId = evento.vinculo?.parentItemId;
  if (parentId) {
    const padre = items.find((i) => i.id === parentId);
    if (padre && esPruebaAudienciaReal(padre)) return padre.id;
  }
  return findPruebaMadreParaFantasma(items, evento)?.id ?? null;
}

function scoreEventoAudiencia(item: ControlPruebaItem): number {
  let score = item.orden;
  if (item.fechaLimite) score += 10_000;
  if (item.audiencia?.hora) score += 1_000;
  if (item.vinculo?.rol === ROL_AUDIENCIA_PRUEBA) score += 100;
  return score;
}

function repararEventoAudienciaDegradado(item: ControlPruebaItem): ControlPruebaItem {
  if (item.vinculo?.rol !== ROL_AUDIENCIA_PRUEBA) return item;
  if (resolveCategoria(item) === 'audiencia') return item;
  const { audienciaPrueba: _omit, ...rest } = item;
  return {
    ...rest,
    categoria: 'audiencia',
    estado: item.estado === 'audiencia_fijada' ? 'programada' : item.estado,
  };
}

function ensurePruebaCategoria(item: ControlPruebaItem): ControlPruebaItem {
  if (!esPruebaAudienciaOfrecida(item)) return item;
  if (esEventoAudienciaPrueba(item)) return item;
  if (item.vinculo?.rol === ROL_AUDIENCIA_PRUEBA) {
    if (resolveCategoria(item) === 'audiencia') return item;
    const { audienciaPrueba: _omit, ...rest } = item;
    return { ...rest, categoria: 'audiencia' };
  }
  if (esDescripcionEventoAudiencia(item.descripcion)) return item;
  if (resolveCategoria(item) === 'prueba') return item;
  return {
    ...item,
    categoria: 'prueba',
    ...(item.audienciaPrueba ? { audienciaPrueba: item.audienciaPrueba } : {}),
  };
}

const ESTADOS_EVENTO_CERRADO = new Set(['realizada', 'cancelada', 'suspendida']);

function tieneEventoAudienciaParaPrueba(items: ControlPruebaItem[], pruebaId: string): boolean {
  return items.some(
    (i) => esEventoAudienciaCandidato(i) && resolverPruebaMadreId(items, i) === pruebaId,
  );
}

/**
 * Deja como máximo 1 evento abierto por prueba madre; elimina decenas de duplicados legacy.
 * Reasigna cédulas colgando de eventos eliminados.
 */
function consolidarEventosAudienciaPorPrueba(items: ControlPruebaItem[]): ControlPruebaItem[] {
  const candidatos = items.filter(esEventoAudienciaCandidato);
  const porMadre = new Map<string, ControlPruebaItem[]>();

  for (const ev of candidatos) {
    const madreId = resolverPruebaMadreId(items, ev);
    if (!madreId) continue;
    const list = porMadre.get(madreId) ?? [];
    list.push(ev);
    porMadre.set(madreId, list);
  }

  const keepIds = new Set<string>();
  const reassignEvento = new Map<string, string>();

  for (const [madreId, eventos] of porMadre) {
    if (eventos.length === 0) continue;

    const madre = items.find((i) => i.id === madreId);
    if (!madre) continue;

    const abiertos = eventos.filter((e) => !ESTADOS_EVENTO_CERRADO.has(String(e.estado)));
    const cerrados = eventos.filter((e) => ESTADOS_EVENTO_CERRADO.has(String(e.estado)));

    if (abiertos.length > 0) {
      const mejor = [...abiertos].sort((a, b) => scoreEventoAudiencia(b) - scoreEventoAudiencia(a))[0]!;
      keepIds.add(mejor.id);
      for (const ev of abiertos) {
        if (ev.id !== mejor.id) reassignEvento.set(ev.id, mejor.id);
      }
    }

    if (cerrados.length > 0) {
      const mejorCerrado = [...cerrados].sort((a, b) => scoreEventoAudiencia(b) - scoreEventoAudiencia(a))[0]!;
      keepIds.add(mejorCerrado.id);
      for (const ev of cerrados) {
        if (ev.id !== mejorCerrado.id) reassignEvento.set(ev.id, mejorCerrado.id);
      }
    }
  }

  let working = items.filter((item) => {
    if (!esEventoAudienciaCandidato(item)) return true;
    const madreId = resolverPruebaMadreId(items, item);
    if (!madreId) return false;
    return keepIds.has(item.id);
  });

  working = working.map((item) => {
    if (!esEventoAudienciaCandidato(item)) return item;
    const madreId = resolverPruebaMadreId(items, item);
    if (!madreId) return item;
    const madre = items.find((i) => i.id === madreId);
    if (!madre) return item;

    const vinculo = {
      parentItemId: madreId,
      parentTipo: madre.tipo === 'testimonial' ? ('testimonial' as const) : ('confesional' as const),
      parentCategoria: 'prueba' as const,
      rol: ROL_AUDIENCIA_PRUEBA,
      autoCreated: item.vinculo?.autoCreated ?? true,
      vinculoLabel: item.vinculo?.vinculoLabel || `Audiencia — ${madre.descripcion.slice(0, 60)}`,
      triggerKey: item.vinculo?.triggerKey || `${ROL_AUDIENCIA_PRUEBA}|${madreId}|recovery`,
    };

    return {
      ...item,
      categoria: 'audiencia' as const,
      vinculo,
      estado:
        String(item.estado) === 'audiencia_fijada' || String(item.estado) === 'pendiente_produccion'
          ? 'programada'
          : item.estado,
    };
  });

  working = working.map((item) => {
    if (item.vinculo?.rol !== 'cedula_audiencia') return item;
    let parentId = item.vinculo.parentItemId;
    while (parentId && reassignEvento.has(parentId)) {
      parentId = reassignEvento.get(parentId)!;
    }
    if (parentId === item.vinculo.parentItemId) return item;
    return {
      ...item,
      vinculo: { ...item.vinculo, parentItemId: parentId, parentCategoria: 'audiencia' },
    };
  });

  return working;
}

function limpiarConfesionalesFantasmaEnPrueba(items: ControlPruebaItem[]): ControlPruebaItem[] {
  const out: ControlPruebaItem[] = [];

  for (const item of items) {
    if (!esConfesionalFantasmaEnPrueba(item)) {
      out.push(item);
      continue;
    }

    const madre = findPruebaMadreParaFantasma(items, item);
    if (!madre) continue;

    if (tieneEventoAudienciaParaPrueba([...items, ...out], madre.id)) continue;

    out.push(
      repararEventoAudienciaDegradado({
        ...item,
        categoria: 'audiencia',
        estado: String(item.estado) === 'audiencia_fijada' ? 'programada' : item.estado,
        vinculo: {
          parentItemId: madre.id,
          parentTipo: madre.tipo === 'testimonial' ? 'testimonial' : 'confesional',
          parentCategoria: 'prueba',
          rol: ROL_AUDIENCIA_PRUEBA,
          autoCreated: true,
          vinculoLabel: item.vinculo?.vinculoLabel || `Audiencia — ${madre.descripcion.slice(0, 60)}`,
          triggerKey: item.vinculo?.triggerKey || `${ROL_AUDIENCIA_PRUEBA}|${madre.id}|recovery`,
        },
      }),
    );
  }

  return out;
}

function findOrCreateEventoParaPrueba(
  items: ControlPruebaItem[],
  prueba: ControlPruebaItem,
): { items: ControlPruebaItem[]; evento: ControlPruebaItem } {
  const existente = eventoAudienciaActivoDePrueba(items, prueba.id);
  if (existente) return { items, evento: existente };

  const fijada =
    audienciaEstaFijadaParaCedula(prueba) ||
    Boolean(prueba.audienciaPrueba?.audienciaFijada) ||
    prueba.estado === 'audiencia_fijada';

  if (!fijada) {
    const stub: ControlPruebaItem = {
      ...prueba,
      id: '__missing__',
      categoria: 'audiencia',
    };
    return { items, evento: stub };
  }

  if (tieneEventoAudienciaParaPrueba(items, prueba.id)) {
    const eventos = items.filter(
      (i) => esEventoAudienciaCandidato(i) && resolverPruebaMadreId(items, i) === prueba.id,
    );
    const activo = eventos.find((e) => !ESTADOS_EVENTO_CERRADO.has(String(e.estado))) ?? eventos[eventos.length - 1];
    if (activo) return { items, evento: activo };
  }

  const evento = buildEventoAudienciaPrueba(prueba, items, {
    autoCreated: true,
    orden: items.length + 1,
  });
  return { items: [...items, evento], evento };
}

/** Normaliza modelo prueba → evento audiencia → cédula al cargar expediente. */
export function migrateModeloAudienciaPrueba(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let working = items.map((item) => ({ ...item }));

  working = working.map(repararEventoAudienciaDegradado);
  working = limpiarConfesionalesFantasmaEnPrueba(working);
  working = working.map(ensurePruebaCategoria);
  working = consolidarEventosAudienciaPorPrueba(working);

  for (let i = 0; i < working.length; i++) {
    const item = working[i]!;
    if (!esPruebaAudienciaReal(item)) continue;
    if (!audienciaEstaFijadaParaCedula(item) && item.estado !== 'audiencia_fijada') continue;
    if (tieneEventoAudienciaParaPrueba(working, item.id)) continue;

    const evento = buildEventoAudienciaPrueba(item, working, {
      autoCreated: true,
      orden: working.length + 1,
    });
    working = [...working, evento];
  }

  working = working.map((item) => {
    if (!esPruebaAudienciaReal(item)) return item;
    if (!tieneEventoAudienciaParaPrueba(working, item.id)) return item;
    if (item.estado === 'audiencia_fijada') return item;
    if (item.estado === 'producida' || item.estado === 'valoracion_judicial') return item;
    return { ...item, estado: 'audiencia_fijada' };
  });

  working = working.map((item) => {
    if (item.vinculo?.rol !== 'cedula_audiencia') return item;
    const parentId = item.vinculo.parentItemId;
    const padre = working.find((p) => p.id === parentId);
    if (!padre) return item;

    let pruebaMadre: ControlPruebaItem | undefined;
    if (esPruebaAudienciaReal(padre)) {
      pruebaMadre = padre;
    } else if (esEventoAudienciaCandidato(padre)) {
      const pruebaId = resolverPruebaMadreId(working, padre);
      pruebaMadre = pruebaId ? working.find((p) => p.id === pruebaId) : undefined;
    }
    if (!pruebaMadre || !esPruebaAudienciaReal(pruebaMadre)) return item;

    const { items: withEvento, evento } = findOrCreateEventoParaPrueba(working, pruebaMadre);
    if (evento.id === '__missing__') return item;
    working = withEvento;

    return {
      ...item,
      vinculo: {
        ...item.vinculo,
        parentItemId: evento.id,
        parentCategoria: 'audiencia',
        vinculoLabel: item.vinculo.vinculoLabel || `Cédula — ${evento.descripcion.slice(0, 60)}`,
      },
      diligencia: {
        ...item.diligencia,
        pruebaVinculadaId: pruebaMadre.id,
      },
    };
  });

  working = consolidarEventosAudienciaPorPrueba(working);

  for (const item of working) {
    if (!esPruebaAudienciaReal(item)) continue;
    if (item.estado !== 'audiencia_fijada' && !audienciaEstaFijadaParaCedula(item)) continue;
    if (tieneEventoAudienciaParaPrueba(working, item.id)) continue;
    const evento = buildEventoAudienciaPrueba(item, working, {
      autoCreated: true,
      orden: working.length + 1,
    });
    working = [...working, evento];
  }

  working = consolidarEventosAudienciaPorPrueba(working);

  working = working.map((item) => {
    if (!esPruebaAudienciaReal(item)) return item;
    const sync = sincronizarEstadoPruebaConEventos(item, working);
    return sync ? { ...item, ...sync } : item;
  });

  return working.map((item, index) => ({ ...item, orden: index + 1 }));
}

export function esCedulaDeEventoAudiencia(item: ControlPruebaItem): boolean {
  return item.vinculo?.rol === 'cedula_audiencia' && resolveCategoria(item) === 'diligencia';
}

export function eventoPadreDeCedula(items: ControlPruebaItem[], cedula: ControlPruebaItem): ControlPruebaItem | undefined {
  const parentId = cedula.vinculo?.parentItemId;
  if (!parentId) return undefined;
  const padre = items.find((i) => i.id === parentId);
  if (padre && esEventoAudienciaPrueba(padre)) return padre;
  return undefined;
}

export { ROL_AUDIENCIA_PRUEBA };
