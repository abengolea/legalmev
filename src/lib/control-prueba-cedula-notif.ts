import type {
  CedulaNotifMedio,
  ControlPruebaItem,
} from '@/types/control-prueba';
import {
  CEDULA_NOTIF_ESTADOS_ELECTRONICA,
  CEDULA_NOTIF_ESTADOS_PAPEL,
  OFICIO_ELECTRONICO_ESTADOS,
} from '@/types/control-prueba';
import type { EstadoStyle } from '@/lib/control-prueba';

export const CEDULA_NOTIF_ESTADO_STYLE: Record<string, EstadoStyle> = {
  pendiente_realizacion: {
    label: 'Pendiente de realización',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    rowClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
  presentada: {
    label: 'Presentada',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    rowClass: 'border-l-violet-500',
    dotClass: 'bg-violet-500',
  },
  librada: {
    label: 'Librada',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    rowClass: 'border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  observada: {
    label: 'Observada',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    rowClass: 'border-l-orange-500',
    dotClass: 'bg-orange-500',
  },
  retirada: {
    label: 'Retirada',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    rowClass: 'border-l-teal-500',
    dotClass: 'bg-teal-500',
  },
  pendiente_diligenciamiento: {
    label: 'Pendiente diligenciamiento',
    badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    rowClass: 'border-l-yellow-500',
    dotClass: 'bg-yellow-500',
  },
  notificada: {
    label: 'Notificada',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  resultado_negativo: {
    label: 'Resultado negativo',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    rowClass: 'border-l-red-500 bg-red-50/40',
    dotClass: 'bg-red-500',
  },
  librada_notificada: {
    label: 'Librada y notificada',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  contestacion_parcial: {
    label: 'Cumpl. parcial',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    rowClass: 'border-l-fuchsia-500 bg-fuchsia-50/50',
    dotClass: 'bg-fuchsia-500',
  },
};

/** Etiquetas en masculino (oficio electrónico) — mismos estilos que cédula */
export const OFICIO_ELECTRONICO_ESTADO_STYLE: Record<string, EstadoStyle> = {
  pendiente_realizacion: CEDULA_NOTIF_ESTADO_STYLE.pendiente_realizacion,
  presentada: {
    ...CEDULA_NOTIF_ESTADO_STYLE.presentada,
    label: 'Presentado',
  },
  observada: {
    ...CEDULA_NOTIF_ESTADO_STYLE.observada,
    label: 'Observado',
  },
  contestacion_parcial: CEDULA_NOTIF_ESTADO_STYLE.contestacion_parcial,
  librada_notificada: {
    ...CEDULA_NOTIF_ESTADO_STYLE.librada_notificada,
    label: 'Librado y notificado',
  },
  cumplido: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
};

export const CEDULA_NOTIF_MEDIO_LABELS: Record<CedulaNotifMedio, string> = {
  papel: 'Cédula papel',
  electronica: 'Cédula electrónica',
};

const TIPOS_ESTADOS_ESPECIALES = ['cedula', 'cedula_electronica', 'oficio_electronico'] as const;

/** Cédula u oficio con flujo de estados papel / electrónico acordado */
export function usaEstadosComunicacionEspeciales(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo'>,
): boolean {
  return (
    item.categoria === 'diligencia' &&
    (TIPOS_ESTADOS_ESPECIALES as readonly string[]).includes(item.tipo)
  );
}

/** Cédula de notificación vinculada a audiencia confesional/testimonial */
export function esCedulaNotificacionAudiencia(item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo'>): boolean {
  return (
    usaEstadosComunicacionEspeciales(item) &&
    (item.tipo === 'cedula' || item.tipo === 'cedula_electronica') &&
    item.vinculo?.rol === 'cedula_audiencia'
  );
}

/** Cédula de intimación para prueba documental en poder de la contraparte */
export function esCedulaIntimacionDocumental(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo'>,
): boolean {
  return (
    usaEstadosComunicacionEspeciales(item) &&
    (item.tipo === 'cedula' || item.tipo === 'cedula_electronica') &&
    item.vinculo?.rol === 'cedula_intimacion_documental'
  );
}

export function esComunicacionElectronica(item: Pick<ControlPruebaItem, 'tipo' | 'diligencia'>): boolean {
  if (item.tipo === 'cedula_electronica' || item.tipo === 'oficio_electronico') return true;
  if (item.tipo === 'cedula' && item.diligencia?.medioNotificacion === 'electronica') return true;
  return false;
}

export function esComunicacionCedulaPapel(item: Pick<ControlPruebaItem, 'tipo' | 'diligencia'>): boolean {
  return item.tipo === 'cedula' && !esComunicacionElectronica(item);
}

export function getMedioCedulaNotificacion(item: Pick<ControlPruebaItem, 'diligencia' | 'tipo'>): CedulaNotifMedio {
  return esComunicacionElectronica(item) ? 'electronica' : 'papel';
}

export function estadosComunicacion(item: Pick<ControlPruebaItem, 'tipo' | 'diligencia'>): readonly string[] {
  if (item.tipo === 'oficio_electronico') {
    return OFICIO_ELECTRONICO_ESTADOS;
  }
  if (item.tipo === 'cedula_electronica') {
    return CEDULA_NOTIF_ESTADOS_ELECTRONICA;
  }
  if (item.tipo === 'cedula') {
    return esComunicacionElectronica(item)
      ? CEDULA_NOTIF_ESTADOS_ELECTRONICA
      : CEDULA_NOTIF_ESTADOS_PAPEL;
  }
  return CEDULA_NOTIF_ESTADOS_PAPEL;
}

/** @deprecated usar estadosComunicacion */
export const estadosCedulaNotificacionAudiencia = estadosComunicacion;

export function estadosTerminalesComunicacion(
  item: Pick<ControlPruebaItem, 'diligencia' | 'tipo' | 'estado'>,
): readonly string[] {
  if (item.tipo === 'oficio_electronico') {
    return ['librada_notificada', 'cumplido'];
  }
  if (esComunicacionElectronica(item)) {
    return ['librada_notificada'];
  }
  return ['notificada', 'resultado_negativo'];
}

/** @deprecated usar estadosTerminalesComunicacion */
export const estadosTerminalesCedulaNotificacion = estadosTerminalesComunicacion;

const LEGACY_A_COMUNICACION: Record<string, string> = {
  pendiente: 'pendiente_realizacion',
  enviado: 'presentada',
  presentado: 'presentada',
  observado: 'observada',
  librado: 'librada',
  librada: 'librada',
  diligenciado: 'notificada',
  notificada: 'notificada',
  negativo: 'resultado_negativo',
  negativa: 'resultado_negativo',
  nulo: 'resultado_negativo',
  contestado: 'observada',
  contestacion_parcial: 'contestacion_parcial',
  cumplido: 'notificada',
  vencido: 'pendiente_diligenciamiento',
  sin_efecto: 'resultado_negativo',
};

const COMUNICACION_A_GENERICO: Record<string, string> = {
  pendiente_realizacion: 'pendiente',
  presentada: 'presentado',
  librada: 'librado',
  observada: 'observado',
  contestacion_parcial: 'contestacion_parcial',
  retirada: 'pendiente',
  pendiente_diligenciamiento: 'pendiente',
  notificada: 'diligenciado',
  resultado_negativo: 'vencido',
  librada_notificada: 'diligenciado',
  cumplido: 'cumplido',
};

export function migrateEstadoComunicacion(estado: string, tipo?: string): string {
  if (tipo === 'oficio_electronico' && estado === 'cumplido') return 'cumplido';
  return LEGACY_A_COMUNICACION[estado] ?? estado;
}

/** @deprecated */
export const migrateEstadoCedulaNotificacion = migrateEstadoComunicacion;

export function migrateEstadoComunicacionAGenerico(estado: string): string {
  return COMUNICACION_A_GENERICO[estado] ?? 'pendiente';
}

export function coerceEstadoComunicacion(
  item: Pick<ControlPruebaItem, 'diligencia' | 'tipo' | 'estado'>,
): string {
  if (!usaEstadosComunicacionEspeciales(item)) return String(item.estado);
  const electronica = esComunicacionElectronica(item);
  let estado = migrateEstadoComunicacion(String(item.estado), item.tipo);
  const validos =
    item.tipo === 'oficio_electronico'
      ? OFICIO_ELECTRONICO_ESTADOS
      : electronica
        ? CEDULA_NOTIF_ESTADOS_ELECTRONICA
        : CEDULA_NOTIF_ESTADOS_PAPEL;

  if (!(validos as readonly string[]).includes(estado)) {
    if (electronica && estado === 'notificada') return 'librada_notificada';
    if (electronica && ['librada', 'presentada', 'retirada', 'pendiente_diligenciamiento'].includes(estado)) {
      return 'pendiente_realizacion';
    }
    return 'pendiente_realizacion';
  }
  return estado;
}

/** @deprecated */
export const coerceEstadoCedulaNotificacion = coerceEstadoComunicacion;

export function normalizarEstadosComunicacion(item: ControlPruebaItem): ControlPruebaItem {
  if (!usaEstadosComunicacionEspeciales(item)) return item;
  const medio = getMedioCedulaNotificacion(item);
  const estado = coerceEstadoComunicacion({
    ...item,
    diligencia: { ...item.diligencia, medioNotificacion: item.tipo === 'cedula' ? medio : item.diligencia?.medioNotificacion },
  });
  return {
    ...item,
    estado,
    diligencia: {
      ...item.diligencia,
      ...(item.tipo === 'cedula' || item.tipo === 'cedula_electronica'
        ? { medioNotificacion: item.tipo === 'cedula_electronica' ? 'electronica' : medio }
        : {}),
    },
  };
}

/** @deprecated */
export const normalizarItemCedulaNotifAudiencia = normalizarEstadosComunicacion;

export function patchMedioCedulaNotificacion(
  item: ControlPruebaItem,
  medio: CedulaNotifMedio,
): Partial<ControlPruebaItem> {
  if (item.tipo !== 'cedula') return {};
  const next: Partial<ControlPruebaItem> = {
    diligencia: { ...item.diligencia, medioNotificacion: medio },
  };
  const estado = coerceEstadoComunicacion({
    ...item,
    diligencia: { ...item.diligencia, medioNotificacion: medio },
  });
  if (estado !== item.estado) next.estado = estado;
  return next;
}

export function patchTipoComunicacion(item: ControlPruebaItem, nuevoTipo: string): Partial<ControlPruebaItem> {
  const patch: Partial<ControlPruebaItem> = {
    tipo: nuevoTipo,
    categoria: 'diligencia',
  };
  const preview: ControlPruebaItem = { ...item, ...patch };

  if (usaEstadosComunicacionEspeciales(preview)) {
    patch.estado = coerceEstadoComunicacion(preview);
    if (nuevoTipo === 'cedula_electronica') {
      patch.diligencia = { ...item.diligencia, medioNotificacion: 'electronica' };
    } else if (nuevoTipo === 'cedula') {
      patch.diligencia = { ...item.diligencia, medioNotificacion: 'papel' };
    }
    return patch;
  }

  if (usaEstadosComunicacionEspeciales(item)) {
    patch.estado = migrateEstadoComunicacionAGenerico(String(item.estado));
  }

  return patch;
}

export function defaultEstadoComunicacion(tipo: string): string {
  if ((TIPOS_ESTADOS_ESPECIALES as readonly string[]).includes(tipo)) {
    return 'pendiente_realizacion';
  }
  return 'pendiente';
}
