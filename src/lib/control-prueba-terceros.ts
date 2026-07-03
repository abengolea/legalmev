import type { ControlPruebaItem } from '@/types/control-prueba';

export const TERCERO_SIN_IDENTIFICAR = 'Sin identificar';

export function normalizarNombreTercero(nombre: string | null | undefined): string | null {
  const n = nombre?.trim();
  return n || null;
}

/** Lista única de terceros del expediente (cabecera + asignados en ítems). */
export function listaTercerosExpediente(
  tercerosHeader: string[] | undefined,
  items: ControlPruebaItem[],
): string[] {
  const set = new Set<string>();
  for (const t of tercerosHeader ?? []) {
    const n = normalizarNombreTercero(t);
    if (n) set.add(n);
  }
  for (const item of items) {
    if (item.ofrecidaPor === 'tercero') {
      const n = normalizarNombreTercero(item.terceroNombre);
      if (n) set.add(n);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

export function claveTerceroItem(item: ControlPruebaItem): string {
  if (item.ofrecidaPor !== 'tercero') return TERCERO_SIN_IDENTIFICAR;
  return normalizarNombreTercero(item.terceroNombre) ?? TERCERO_SIN_IDENTIFICAR;
}

export function agruparItemsPorTercero(items: ControlPruebaItem[]): Map<string, ControlPruebaItem[]> {
  const map = new Map<string, ControlPruebaItem[]>();
  for (const item of items) {
    if (item.ofrecidaPor !== 'tercero') continue;
    const key = claveTerceroItem(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export function ordenGruposTercero(grupos: Map<string, ControlPruebaItem[]>): string[] {
  const keys = [...grupos.keys()];
  return keys.sort((a, b) => {
    if (a === TERCERO_SIN_IDENTIFICAR) return 1;
    if (b === TERCERO_SIN_IDENTIFICAR) return -1;
    return a.localeCompare(b, 'es');
  });
}

export function contarItemsTercero(items: ControlPruebaItem[]): number {
  return items.filter((i) => i.ofrecidaPor === 'tercero').length;
}
