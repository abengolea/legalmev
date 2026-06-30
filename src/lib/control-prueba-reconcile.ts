import type { ControlPruebaItem } from '@/types/control-prueba';
import { normalizeItems, resolveCategoria } from '@/lib/control-prueba';

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similitud(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  for (const w of wordsA) if (wordsB.has(w)) common += 1;
  return common / Math.max(wordsA.size, wordsB.size);
}

function matchKey(item: ControlPruebaItem): string {
  return `${resolveCategoria(item)}|${item.tipo}|${item.ofrecidaPor ?? ''}`;
}

export type ReconcileResult = {
  items: ControlPruebaItem[];
  added: number;
  updated: number;
  unchanged: number;
};

/**
 * Reconcilia ítems importados con existentes: actualiza estados/descripciones si coinciden,
 * agrega solo los nuevos.
 */
export function reconciliarItems(
  existentes: ControlPruebaItem[],
  importados: ControlPruebaItem[],
): ReconcileResult {
  const base = existentes.map((i) => ({ ...i }));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const imp of importados) {
    const key = matchKey(imp);
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < base.length; i++) {
      if (matchKey(base[i]) !== key) continue;
      const score = similitud(base[i].descripcion, imp.descripcion);
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const prev = base[bestIdx];
      const patch: Partial<ControlPruebaItem> = {};
      if (imp.estado && imp.estado !== prev.estado) patch.estado = imp.estado;
      if (imp.descripcion && imp.descripcion.length > prev.descripcion.length) patch.descripcion = imp.descripcion;
      if (imp.fechaLimite && !prev.fechaLimite) patch.fechaLimite = imp.fechaLimite;
      if (imp.observaciones && !prev.observaciones) patch.observaciones = imp.observaciones;
      if (Object.keys(patch).length > 0) {
        base[bestIdx] = { ...prev, ...patch };
        updated += 1;
      } else {
        unchanged += 1;
      }
    } else {
      base.push({ ...imp, id: imp.id || crypto.randomUUID(), orden: base.length + 1 });
      added += 1;
    }
  }

  return { items: normalizeItems(base), added, updated, unchanged };
}
