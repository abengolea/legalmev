import type { ControlPruebaItem } from '@/types/control-prueba';
import { TIPO_LABELS } from '@/lib/control-prueba';

export const PERICIAL_ESPECIALIDADES = [
  'contable',
  'informatica',
  'ingenieria',
  'medica',
  'psicologica',
  'caligrafica',
  'tasacion',
  'grafotecnica',
  'otra',
] as const;

export type PericialEspecialidad = (typeof PERICIAL_ESPECIALIDADES)[number];

export const PERICIAL_ESPECIALIDAD_LABELS: Record<PericialEspecialidad, string> = {
  contable: 'Contable',
  informatica: 'Informática',
  ingenieria: 'Ingeniería',
  medica: 'Médica',
  psicologica: 'Psicológica',
  caligrafica: 'Caligráfica',
  tasacion: 'Tasación',
  grafotecnica: 'Grafotécnica',
  otra: 'Otra',
};

const PERICIAL_PREFIX = 'pericial:';

/** Valor unificado para el selector de tipo (incluye pericial + especialidad). */
export function tipoPruebaSelectValue(item: ControlPruebaItem): string {
  if (item.tipo === 'pericial') {
    const esp = item.pericial?.especialidad;
    if (esp && PERICIAL_ESPECIALIDAD_LABELS[esp as PericialEspecialidad]) {
      return `${PERICIAL_PREFIX}${esp}`;
    }
    const inferida = inferirEspecialidadPericial(item.descripcion);
    if (inferida) return `${PERICIAL_PREFIX}${inferida}`;
    return `${PERICIAL_PREFIX}otra`;
  }
  return item.tipo;
}

export function labelTipoPrueba(item: ControlPruebaItem): string {
  if (item.tipo === 'pericial') {
    const esp = item.pericial?.especialidad ?? inferirEspecialidadPericial(item.descripcion) ?? 'otra';
    const label = PERICIAL_ESPECIALIDAD_LABELS[esp as PericialEspecialidad] ?? esp;
    return `Pericial ${label}`;
  }
  return TIPO_LABELS[item.tipo] ?? item.tipo;
}

export function parseTipoPruebaSelectValue(
  value: string,
  pericialPrev?: ControlPruebaItem['pericial'],
): Pick<ControlPruebaItem, 'tipo' | 'pericial'> {
  if (value.startsWith(PERICIAL_PREFIX)) {
    const especialidad = value.slice(PERICIAL_PREFIX.length) as PericialEspecialidad;
    return {
      tipo: 'pericial',
      pericial: { ...pericialPrev, especialidad },
    };
  }
  return { tipo: value };
}

/** Detecta especialidad desde texto (import IA o descripción existente). */
export function inferirEspecialidadPericial(texto: string): PericialEspecialidad | null {
  const d = texto.toLowerCase();
  if (/\bcontab/.test(d)) return 'contable';
  if (/\binform[aá]t/.test(d) || /\bsistemas\b/.test(d) || /\bp[aá]ginas web\b/.test(d)) return 'informatica';
  if (/\bingenier/.test(d) || /\barquitect/.test(d) || /\belectr[oó]n/.test(d)) return 'ingenieria';
  if (/\bm[eé]dic/.test(d) || /\bclinic/.test(d) || /\btraumat/.test(d)) return 'medica';
  if (/\bpsicolog/.test(d) || /\bpsiqui/.test(d)) return 'psicologica';
  if (/\bcal[ií]graf/.test(d)) return 'caligrafica';
  if (/\btasaci[oó]n/.test(d) || /\binmobili/.test(d)) return 'tasacion';
  if (/\bgrafot[eé]cn/.test(d) || /\bfirma/.test(d)) return 'grafotecnica';
  return null;
}

export const DESCRIPCION_PERICIAL_LABEL = 'Objeto / a qué se apunta la pericia';
export const DESCRIPCION_PERICIAL_PLACEHOLDER =
  'Ej: auditoría de movimientos bancarios 2019-2022; autenticidad de páginas web; valuación de daño emergente…';

export function ensurePericialMeta(item: ControlPruebaItem): ControlPruebaItem {
  if (item.tipo !== 'pericial') return item;
  const especialidad =
    item.pericial?.especialidad ?? inferirEspecialidadPericial(item.descripcion) ?? 'otra';
  return {
    ...item,
    pericial: { ...item.pericial, especialidad },
  };
}

/** Opciones del selector de tipo en tabla de prueba. */
export function opcionesTipoPrueba(tiposBase: readonly string[]): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (const t of tiposBase) {
    if (t === 'pericial') {
      for (const esp of PERICIAL_ESPECIALIDADES) {
        opts.push({
          value: `${PERICIAL_PREFIX}${esp}`,
          label: `Pericial ${PERICIAL_ESPECIALIDAD_LABELS[esp]}`,
        });
      }
    } else {
      opts.push({ value: t, label: TIPO_LABELS[t] ?? t });
    }
  }
  return opts;
}
