import type { ControlPruebaItem } from '@/types/control-prueba';

/**
 * Madre cerrada → sus hijos (cédulas, oficios, eventos) no se listan en el control.
 * Incluye oficios/informativa en «cumplido» (legacy) o «producida».
 */
const ESTADOS_MADRE_CERRADA = new Set([
  'producida',
  'valoracion_judicial',
  'cumplido',
  'desistida',
  'no_admitida',
]);

export function madreEstaCerrada(
  madre: Pick<ControlPruebaItem, 'estado' | 'tipo' | 'categoria'>,
): boolean {
  return ESTADOS_MADRE_CERRADA.has(String(madre.estado));
}

function padreIdDeVinculo(item: ControlPruebaItem): string | null {
  return item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
}

/** True si el ítem cuelga de una madre (o abuela) ya cerrada. */
export function esHijoDeMadreCerrada(
  item: ControlPruebaItem,
  allItems: ControlPruebaItem[],
): boolean {
  const padreId = padreIdDeVinculo(item);
  if (!padreId) return false;
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const padre = byId.get(padreId);
  if (!padre) return false;
  if (madreEstaCerrada(padre)) return true;
  const abueloId = padreIdDeVinculo(padre);
  if (!abueloId) return false;
  const abuelo = byId.get(abueloId);
  return Boolean(abuelo && madreEstaCerrada(abuelo));
}
