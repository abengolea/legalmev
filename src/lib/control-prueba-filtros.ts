import type { ControlPruebaItem } from '@/types/control-prueba';
import { TIPOS_AUDIENCIA, TIPOS_DILIGENCIA, TIPOS_PRUEBA } from '@/types/control-prueba';
import { TIPO_LABELS } from '@/lib/control-prueba';
import {
  inferirEspecialidadPericial,
  opcionesTipoPrueba,
  PERICIAL_PREFIX,
} from '@/lib/control-prueba-pericial';

export type OpcionFiltroTipo = {
  value: string;
  label: string;
  grupo: 'prueba' | 'diligencia' | 'audiencia';
};

const GRUPO_LABELS: Record<OpcionFiltroTipo['grupo'], string> = {
  prueba: 'Prueba ofrecida',
  diligencia: 'Comunicaciones',
  audiencia: 'Audiencias',
};

export function opcionesFiltroTipoExpediente(): OpcionFiltroTipo[] {
  const prueba: OpcionFiltroTipo[] = opcionesTipoPrueba(TIPOS_PRUEBA).map((o) => ({
    ...o,
    grupo: 'prueba',
  }));
  const diligencia: OpcionFiltroTipo[] = TIPOS_DILIGENCIA.map((t) => ({
    value: t,
    label: TIPO_LABELS[t] ?? t,
    grupo: 'diligencia',
  }));
  const audiencia: OpcionFiltroTipo[] = TIPOS_AUDIENCIA.map((t) => ({
    value: t,
    label: TIPO_LABELS[t] ?? t,
    grupo: 'audiencia',
  }));
  return [...prueba, ...diligencia, ...audiencia];
}

export { GRUPO_LABELS as FILTRO_TIPO_GRUPO_LABELS };

export function itemPasaFiltroTipo(item: ControlPruebaItem, filtro: string): boolean {
  if (filtro === 'all') return true;

  if (filtro.startsWith(PERICIAL_PREFIX)) {
    if (item.tipo !== 'pericial') return false;
    const esp = filtro.slice(PERICIAL_PREFIX.length);
    const itemEsp =
      item.pericial?.especialidad ?? inferirEspecialidadPericial(item.descripcion) ?? 'otra';
    return itemEsp === esp;
  }

  return item.tipo === filtro;
}
