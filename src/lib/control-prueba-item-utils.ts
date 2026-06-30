import type { ControlPruebaItem, ItemHistorialEntry } from '@/types/control-prueba';

export function registrarCambio(
  item: ControlPruebaItem,
  campo: string,
  valorAnterior: string | undefined,
  valorNuevo: string,
  usuario?: string,
): ControlPruebaItem {
  if (valorAnterior === valorNuevo) return item;
  const entry: ItemHistorialEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    usuario: usuario ?? 'Usuario',
    campo,
    valorAnterior,
    valorNuevo,
  };
  const historial = [...(item.historial ?? []), entry].slice(-50);
  return { ...item, historial };
}

export function patchItemConHistorial(
  item: ControlPruebaItem,
  patch: Partial<ControlPruebaItem>,
  usuario?: string,
): ControlPruebaItem {
  let next = { ...item, ...patch };
  for (const [key, val] of Object.entries(patch)) {
    if (key === 'historial' || key === 'subtareas' || key === 'adjuntos') continue;
    const prev = item[key as keyof ControlPruebaItem];
    if (prev !== val && val !== undefined) {
      next = registrarCambio(next, key, String(prev ?? ''), String(val), usuario);
    }
  }
  return next;
}
