import type { ControlPruebaExpediente, ControlPruebaItem, ExpedienteHito } from '@/types/control-prueba';
import { itemsOfrecidasProduccion } from '@/lib/control-prueba';
import { cuentaComoProducidaEnProgreso } from '@/lib/control-prueba-cierre';
import { estadoAgregadoPruebaChip } from '@/lib/control-prueba-pericial-movimientos';
import { evaluarAlertaItem } from '@/lib/control-prueba-alertas';
import { itemEsDeAlgunaParteRepresentada } from '@/lib/control-prueba-resumen';
import type { ParteRepresentada } from '@/lib/control-prueba-resumen';

export type MetricasExpediente = {
  pctProducida: number;
  totalOfrecida: number;
  totalProducida: number;
  totalPendiente: number;
  actor: { total: number; producida: number; pendiente: number };
  demandada: { total: number; producida: number; pendiente: number };
  diasEstimadosRestantes: number | null;
  enRiesgo: number;
};

const ESTADOS_PENDIENTE_CHIP = new Set([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'exhibicion_parcial',
  'apercibimiento_en_contra',
  'autenticidad_impugnada',
]);

function chipEstado(item: ControlPruebaItem): string {
  return estadoAgregadoPruebaChip(item);
}

function statsParte(items: ControlPruebaItem[], parte: string) {
  const subset = itemsOfrecidasProduccion(items).filter((i) => (i.ofrecidaPor ?? 'actor') === parte);
  return {
    total: subset.length,
    producida: subset.filter((i) => cuentaComoProducidaEnProgreso(chipEstado(i))).length,
    pendiente: subset.filter((i) => ESTADOS_PENDIENTE_CHIP.has(chipEstado(i))).length,
  };
}

export function calcularMetricas(items: ControlPruebaItem[]): MetricasExpediente {
  const prueba = itemsOfrecidasProduccion(items);
  const totalOfrecida = prueba.length;
  const totalProducida = prueba.filter((i) => cuentaComoProducidaEnProgreso(chipEstado(i))).length;
  const totalPendiente = prueba.filter((i) => ESTADOS_PENDIENTE_CHIP.has(chipEstado(i))).length;
  const pctProducida = totalOfrecida > 0 ? Math.round((totalProducida / totalOfrecida) * 100) : 0;

  const alertas = items.map((i) => evaluarAlertaItem(i)).filter(Boolean);
  const enRiesgo = alertas.filter((a) => a!.nivel === 'rojo' || a!.nivel === 'amarillo').length;

  const diasPendientes = prueba
    .filter((i) => ESTADOS_PENDIENTE_CHIP.has(chipEstado(i)))
    .map((i) => evaluarAlertaItem(i)?.diasHabiles)
    .filter((d): d is number => d != null && d >= 0);

  const diasEstimadosRestantes =
    diasPendientes.length > 0 ? Math.max(...diasPendientes) : null;

  return {
    pctProducida,
    totalOfrecida,
    totalProducida,
    totalPendiente,
    actor: statsParte(items, 'actor'),
    demandada: statsParte(items, 'demandado'),
    diasEstimadosRestantes,
    enRiesgo,
  };
}

export function progresoExpedienteHeader(
  items: ControlPruebaItem[],
  partes?: ParteRepresentada[] | null,
): number {
  if (partes && partes.length > 0) {
    const subset = items.filter((i) => itemEsDeAlgunaParteRepresentada(i, partes, items));
    return calcularMetricas(subset).pctProducida;
  }
  return calcularMetricas(items).pctProducida;
}

export const HITOS_DEFAULT: Omit<ExpedienteHito, 'id'>[] = [
  { tipo: 'demanda', label: 'Demanda' },
  { tipo: 'contestacion', label: 'Contestación' },
  { tipo: 'apertura_prueba', label: 'Apertura a prueba' },
  { tipo: 'cierre_prueba', label: 'Cierre de prueba' },
  { tipo: 'sentencia', label: 'Sentencia estimada' },
];

export function ensureHitos(hitos?: ExpedienteHito[]): ExpedienteHito[] {
  if (hitos && hitos.length > 0) return hitos;
  return HITOS_DEFAULT.map((h) => ({ ...h, id: crypto.randomUUID(), fecha: null }));
}

export function timelineFromExpediente(exp: Partial<ControlPruebaExpediente>): ExpedienteHito[] {
  return ensureHitos(exp.hitos);
}
