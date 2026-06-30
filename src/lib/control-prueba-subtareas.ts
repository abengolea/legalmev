import type { ControlPruebaItem, ItemSubtarea } from '@/types/control-prueba';

const SUBTAREAS_POR_TIPO: Record<string, readonly string[]> = {
  documental: [
    'Recepción del documento',
    'Impugnación de autenticidad',
    'Prueba informativa vinculada',
    'Oficio sobre autenticidad',
    'Respuesta informativa',
    'Certificación',
  ],
  pericial: [
    'Propuesta de perito',
    'Designación judicial',
    'Presentación de puntos de pericia',
    'Dictamen pericial',
    'Impugnaciones',
  ],
  informativa: ['Oficio librado', 'Acuse de recibo', 'Respuesta recibida', 'Control de la respuesta'],
  confesional: [
    'Pedir fijación de audiencia',
    'Cédula de notificación a la parte',
    'Libramiento de cédula',
    'Diligenciamiento / notificación',
    'Celebración de audiencia',
    'Lectura del acta',
  ],
  testimonial: [
    'Designación de testigos',
    'Pedir fijación de audiencia',
    'Cédula a testigo(s)',
    'Libramiento de cédula',
    'Audiencia testimonial',
    'Acta',
  ],
  documental_en_poder: [
    'Pedido de intimación al tribunal',
    'Intimación ordenada con plazo',
    'Cédula a la parte obligada',
    'Libramiento y notificación',
    'Exhibición de documentación',
    'Control de cumplimiento',
  ],
  inspeccion: ['Solicitud', 'Designación de fecha', 'Inspección judicial', 'Acta'],
};

export function subtareasDefinicionPorTipo(tipo: string): string[] {
  return [...(SUBTAREAS_POR_TIPO[tipo] ?? [])];
}

export function crearSubtareasIniciales(tipo: string): ItemSubtarea[] {
  return subtareasDefinicionPorTipo(tipo).map((titulo) => ({
    id: crypto.randomUUID(),
    titulo,
    completada: false,
    fechaLimite: null,
    observaciones: null,
  }));
}

const SUBTAREAS_DILIGENCIA = ['Presentación / pedido', 'Libramiento judicial', 'Diligenciamiento', 'Contestación / plazo'];

export function subtareasDiligencia(): ItemSubtarea[] {
  return SUBTAREAS_DILIGENCIA.map((titulo) => ({
    id: crypto.randomUUID(),
    titulo,
    completada: false,
    fechaLimite: null,
    observaciones: null,
  }));
}

export function ensureSubtareas(item: ControlPruebaItem): ControlPruebaItem {
  const cat = item.categoria ?? 'prueba';
  if (cat === 'diligencia') {
    if ((item.subtareas?.length ?? 0) > 0) return item;
    return { ...item, subtareas: subtareasDiligencia() };
  }
  if (cat === 'audiencia' && item.tipo !== 'confesional' && item.tipo !== 'testimonial') return item;
  if (cat !== 'prueba' && cat !== 'audiencia') return item;

  const definidas = subtareasDefinicionPorTipo(item.tipo);
  if (definidas.length === 0) return item;

  const existentes = item.subtareas ?? [];
  if (existentes.length === 0) {
    return { ...item, subtareas: crearSubtareasIniciales(item.tipo) };
  }

  const merged: ItemSubtarea[] = definidas.map((titulo) => {
    const prev = existentes.find((s) => s.titulo === titulo);
    return prev ?? { id: crypto.randomUUID(), titulo, completada: false, fechaLimite: null, observaciones: null };
  });

  return { ...item, subtareas: merged };
}

export function progresoSubtareas(item: ControlPruebaItem): { completadas: number; total: number; pct: number } {
  const subs = item.subtareas ?? [];
  if (subs.length === 0) return { completadas: 0, total: 0, pct: 0 };
  const completadas = subs.filter((s) => s.completada).length;
  return { completadas, total: subs.length, pct: Math.round((completadas / subs.length) * 100) };
}

export const TIPO_ICONOS: Record<string, string> = {
  documental: '📄',
  documental_en_poder: '📁',
  pericial: '🔍',
  informativa: '📧',
  confesional: '🎙️',
  testimonial: '👤',
  inspeccion: '🔎',
  oficio: '📨',
  oficio_electronico: '💻',
  cedula: '📬',
  cedula_electronica: '📲',
  mandamiento: '⚖️',
  exhorto: '📤',
  audiencia: '📅',
  vista_causa: '⚖️',
  mediacion: '🤝',
};

export function tipoIcono(tipo: string): string {
  return TIPO_ICONOS[tipo] ?? '📋';
}
