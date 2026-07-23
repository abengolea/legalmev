import { itemsOfrecidasProduccion } from '@/lib/control-prueba';
import { itemVisibleConFiltroEstado } from '@/lib/control-prueba-pericial-movimientos';
import { itemEsNuestraParte } from '@/lib/control-prueba-resumen';
import type { ControlPruebaExpediente, ControlPruebaItem, ParteRepresentadaPrueba } from '@/types/control-prueba';

const PARTES_VALIDAS = new Set<ParteRepresentadaPrueba>(['actor', 'demandado', 'tercero']);

/** Normaliza legacy `parteRepresentada` + nuevo `partesRepresentadas`. */
export function normalizePartesRepresentadas(
  partesRepresentadas?: ParteRepresentadaPrueba[] | null,
  parteRepresentada?: ParteRepresentadaPrueba | '' | null,
): ParteRepresentadaPrueba[] {
  const fromArray = (partesRepresentadas ?? []).filter(
    (p): p is ParteRepresentadaPrueba => PARTES_VALIDAS.has(p as ParteRepresentadaPrueba),
  );
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  if (parteRepresentada && PARTES_VALIDAS.has(parteRepresentada)) {
    return [parteRepresentada];
  }
  return [];
}

export function partesDesdeExpediente(
  exp: Pick<ControlPruebaExpediente, 'partesRepresentadas' | 'parteRepresentada'> | null | undefined,
): ParteRepresentadaPrueba[] {
  if (!exp) return [];
  return normalizePartesRepresentadas(exp.partesRepresentadas, exp.parteRepresentada);
}

/** Persistencia: array + campo legacy (primera parte, o vacío). */
export function payloadPartesRepresentadas(partes: ParteRepresentadaPrueba[]): {
  partesRepresentadas: ParteRepresentadaPrueba[];
  parteRepresentada: ParteRepresentadaPrueba | '';
} {
  const normalized = normalizePartesRepresentadas(partes);
  return {
    partesRepresentadas: normalized,
    parteRepresentada: normalized[0] ?? '',
  };
}

export function itemPerteneceAPartesRepresentadas(
  item: ControlPruebaItem,
  partes: ParteRepresentadaPrueba[],
  allItems: ControlPruebaItem[],
): boolean {
  if (partes.length === 0) return true;
  return partes.some((p) => itemEsNuestraParte(item, p, allItems));
}

/** Pruebas ofrecidas pendientes de producción (misma lógica del badge amarillo). */
export function itemsPendientesProduccion(
  items: ControlPruebaItem[],
  partes?: ParteRepresentadaPrueba[] | null,
): ControlPruebaItem[] {
  const partesNorm = partes?.length ? normalizePartesRepresentadas(partes) : [];
  return itemsOfrecidasProduccion(items).filter((i) => {
    if (partesNorm.length > 0 && !itemPerteneceAPartesRepresentadas(i, partesNorm, items)) {
      return false;
    }
    return itemVisibleConFiltroEstado(i, 'pendiente_produccion');
  });
}

export function contarPendientesProduccion(
  items: ControlPruebaItem[],
  partes?: ParteRepresentadaPrueba[] | null,
): number {
  return itemsPendientesProduccion(items, partes).length;
}

export function labelPartesRepresentadas(
  partes: ParteRepresentadaPrueba[],
  labels: { actor?: string; demandado?: string; tercero?: string },
): string {
  if (partes.length === 0) return '';
  const map: Record<ParteRepresentadaPrueba, string> = {
    actor: labels.actor?.trim() || 'Actor',
    demandado: labels.demandado?.trim() || 'Demandada',
    tercero: labels.tercero?.trim() || 'Tercero',
  };
  return partes.map((p) => map[p]).join(' · ');
}
