import type { ControlPruebaItem } from '@/types/control-prueba';

export type ResolucionVisual = 'completa' | 'parcial' | 'vencida' | null;

const ESTADOS_CUMPLIDO: readonly string[] = [
  'cumplido',
  'diligenciado',
  'notificada',
  'librada_notificada',
  'producida',
  'realizada',
];

const ESTADOS_VENCIDO: readonly string[] = ['vencido', 'resultado_negativo'];

/** Cumplido total, cumplido parcial (contestación parcial) o vencido — para color de fila. */
export function resolucionVisual(item: ControlPruebaItem): ResolucionVisual {
  const estado = String(item.estado);
  if (estado === 'contestacion_parcial') return 'parcial';
  if (ESTADOS_CUMPLIDO.includes(estado)) return 'completa';
  if (ESTADOS_VENCIDO.includes(estado)) return 'vencida';
  return null;
}

export function resolucionFilaClass(item: ControlPruebaItem): string {
  switch (resolucionVisual(item)) {
    case 'completa':
      return 'bg-emerald-50/60 dark:bg-emerald-950/25';
    case 'parcial':
      return 'bg-fuchsia-50/70 dark:bg-fuchsia-950/25';
    case 'vencida':
      return 'bg-red-50/50 dark:bg-red-950/20';
    default:
      return '';
  }
}

export function resolucionEtiqueta(item: ControlPruebaItem, allItems: ControlPruebaItem[]): string | null {
  const r = resolucionVisual(item);
  if (r === 'completa') return 'Cumplido';
  if (r === 'vencida') return 'Vencido / sin resultado';
  if (r === 'parcial') {
    const sucesor = item.diligencia?.oficioSucesorId
      ? allItems.find((i) => i.id === item.diligencia?.oficioSucesorId)
      : null;
    return sucesor
      ? `Cumplido parcial — reiterar en #${sucesor.orden}`
      : 'Cumplido parcial — pendiente oficio de aclaración';
  }
  if (item.diligencia?.oficioOrigenId) {
    const origen = allItems.find((i) => i.id === item.diligencia?.oficioOrigenId);
    return origen ? `Oficio aclaratorio de #${origen.orden}` : 'Oficio aclaratorio';
  }
  return null;
}

export function resolucionBadgeClass(item: ControlPruebaItem): string {
  switch (resolucionVisual(item)) {
    case 'completa':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'parcial':
      return 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300';
    case 'vencida':
      return 'bg-red-100 text-red-900 border-red-300';
    default:
      if (item.diligencia?.oficioOrigenId) {
        return 'bg-sky-100 text-sky-900 border-sky-300';
      }
      return '';
  }
}
