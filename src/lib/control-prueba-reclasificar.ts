import type { ControlItemEstado, ControlPruebaItem, PruebaParte } from '@/types/control-prueba';
import { TIPOS_PRUEBA } from '@/types/control-prueba';
import {
  defaultEstadoForItem,
  isValidEstadoForItem,
  migrateEstadoPrueba,
  TIPO_LABELS,
} from '@/lib/control-prueba';
import { migrateEstadoComunicacionAGenerico } from '@/lib/control-prueba-cedula-notif';
import {
  inferirEspecialidadPericial,
  opcionesTipoPrueba,
  parseTipoPruebaSelectValue,
  PERICIAL_PREFIX,
} from '@/lib/control-prueba-pericial';

export type ParteGrupoTabla = 'actor' | 'demandado' | 'tercero' | 'tribunal';

export type OpcionTipoTabla = {
  value: string;
  label: string;
  grupo: 'actual' | 'prueba' | 'diligencia';
};

function resolverEstadoReclasificacion(item: ControlPruebaItem, tipo: string): ControlItemEstado {
  const prev = String(item.estado);
  const terminales = ['diligenciado', 'cumplido', 'notificada', 'librada_notificada', 'producida', 'realizada'];
  if (terminales.includes(prev)) return 'producida';

  if (item.categoria === 'diligencia') {
    const generico = migrateEstadoComunicacionAGenerico(prev);
    const migrado = migrateEstadoPrueba(generico, tipo);
    if (isValidEstadoForItem({ categoria: 'prueba', tipo, estado: migrado })) {
      return migrado as ControlItemEstado;
    }
  }

  return defaultEstadoForItem('prueba', tipo);
}

function resolverOfrecidaPorReclasificacion(
  item: ControlPruebaItem,
  parteDestino?: ParteGrupoTabla,
): PruebaParte | undefined {
  if (parteDestino !== 'actor' && parteDestino !== 'demandado') return undefined;
  if (item.ofrecidaPor === 'actor' || item.ofrecidaPor === 'demandado') return undefined;
  return parteDestino;
}

/** Opciones del selector de tipo en tabla de comunicaciones (incluye reclasificación a prueba). */
export function opcionesTipoDiligencia(tiposDiligencia: readonly string[]): OpcionTipoTabla[] {
  const comunicacion: OpcionTipoTabla[] = tiposDiligencia.map((t) => ({
    value: t,
    label: TIPO_LABELS[t] ?? t,
    grupo: 'actual',
  }));
  const prueba: OpcionTipoTabla[] = opcionesTipoPrueba(TIPOS_PRUEBA).map((o) => ({
    value: o.value,
    label: o.label,
    grupo: 'prueba',
  }));
  return [...comunicacion, ...prueba];
}

export function esTipoPruebaSelectValue(value: string): boolean {
  return value.startsWith(PERICIAL_PREFIX) || (TIPOS_PRUEBA as readonly string[]).includes(value);
}

/** Mueve un ítem de comunicaciones (u otra categoría) a prueba ofrecida. */
export function patchReclasificarAPrueba(
  item: ControlPruebaItem,
  tipoSelectValue: string,
  opts?: { parteDestino?: ParteGrupoTabla },
): Partial<ControlPruebaItem> {
  const parsed = esTipoPruebaSelectValue(tipoSelectValue)
    ? parseTipoPruebaSelectValue(tipoSelectValue, item.pericial)
    : { tipo: tipoSelectValue, pericial: item.pericial };

  const tipo = parsed.tipo;
  const estado = resolverEstadoReclasificacion(item, tipo);
  const ofrecidaPor = resolverOfrecidaPorReclasificacion(item, opts?.parteDestino);

  const patch: Partial<ControlPruebaItem> = {
    categoria: 'prueba',
    tipo,
    estado,
    diligencia: undefined,
    vinculo: undefined,
    ...(ofrecidaPor ? { ofrecidaPor } : {}),
  };

  if (tipo === 'pericial') {
    patch.pericial = {
      especialidad:
        parsed.pericial?.especialidad ??
        item.pericial?.especialidad ??
        inferirEspecialidadPericial(item.descripcion) ??
        'otra',
    };
  } else {
    patch.pericial = undefined;
  }

  return patch;
}
