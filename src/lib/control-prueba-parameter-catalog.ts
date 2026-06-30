import type { ControlPruebaItem, ItemCategoria } from '@/types/control-prueba';
import {
  ACLARACION_DICTAMEN_ESTADOS,
  AUDIENCIA_ESTADOS,
  CEDULA_NOTIF_ESTADOS_ELECTRONICA,
  CEDULA_NOTIF_ESTADOS_PAPEL,
  DILIGENCIA_ESTADOS,
  IMPUGNACION_INFORME_ESTADOS,
  MEJOR_PROVEER_ESTADOS,
  OFICIO_ELECTRONICO_ESTADOS,
  PERICIAL_ESTADOS,
  PRUEBA_ESTADOS,
} from '@/types/control-prueba';
import { getEstadoConfig, resolveCategoria } from '@/lib/control-prueba';
import {
  estadosParaMovimientoPericial,
  esMovimientoPericial,
} from '@/lib/control-prueba-pericial-movimientos';
import { getMedioCedulaNotificacion } from '@/lib/control-prueba-cedula-notif';

export type ParameterFieldType = 'text' | 'textarea' | 'date' | 'select' | 'boolean';

export type ParameterFieldDef = {
  /** Ruta en el ítem: `estado`, `fechaProduccion`, `diligencia.resultado`, etc. */
  path: string;
  label: string;
  type: ParameterFieldType;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
  rows?: number;
  hint?: string;
};

export type ParameterCatalogEntry = {
  id: string;
  categoria: ItemCategoria | '*';
  /** Tipos que matchean; `*` = todos los de la categoría */
  tipos: readonly string[] | '*';
  titulo: string;
  descripcion?: string;
  fields: ParameterFieldDef[];
};

function opts(estados: readonly string[], item?: ControlPruebaItem): { value: string; label: string }[] {
  const cat = item ? resolveCategoria(item) : 'prueba';
  return estados.map((e) => ({
    value: e,
    label: getEstadoConfig(cat, e, item).label,
  }));
}

export const PARAMETER_CATALOG: ParameterCatalogEntry[] = [
  {
    id: 'diligencia-oficio',
    categoria: 'diligencia',
    tipos: ['oficio', 'exhorto'],
    titulo: 'Resultado del oficio',
    descripcion: 'Registrá libramiento, contestación y cumplimiento del oficio.',
    fields: [
      { path: 'diligencia.destinatario', label: 'Destinatario', type: 'text', placeholder: 'Ej. Banco Santander' },
      { path: 'diligencia.fechaPresentacion', label: 'Fecha presentación pedido', type: 'date' },
      { path: 'diligencia.fechaLibramiento', label: 'Fecha libramiento', type: 'date' },
      { path: 'diligencia.plazoContestacion', label: 'Plazo contestación', type: 'date' },
      { path: 'diligencia.fechaDiligenciamiento', label: 'Fecha contestación / diligenciamiento', type: 'date' },
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(DILIGENCIA_ESTADOS),
      },
      {
        path: 'diligencia.resultado',
        label: 'Resultado / síntesis de contestación',
        type: 'textarea',
        rows: 4,
        placeholder: 'Ej. Contestó parcialmente — falta extracto 2021',
      },
      { path: 'fechaProduccion', label: 'Fecha cumplimiento (prueba vinculada)', type: 'date' },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 2 },
    ],
  },
  {
    id: 'diligencia-oficio-electronico',
    categoria: 'diligencia',
    tipos: ['oficio_electronico'],
    titulo: 'Resultado del oficio electrónico',
    descripcion: 'Flujo MEV: pendiente → observada → contestación parcial → librada y notificada.',
    fields: [
      { path: 'diligencia.destinatario', label: 'Destinatario', type: 'text' },
      { path: 'diligencia.fechaLibramiento', label: 'Fecha libramiento', type: 'date' },
      { path: 'diligencia.plazoContestacion', label: 'Plazo contestación', type: 'date' },
      { path: 'diligencia.fechaDiligenciamiento', label: 'Fecha contestación', type: 'date' },
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(OFICIO_ELECTRONICO_ESTADOS),
      },
      {
        path: 'diligencia.resultado',
        label: 'Resultado',
        type: 'textarea',
        rows: 4,
        placeholder: 'Síntesis de la contestación o motivo de observación',
      },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 2 },
    ],
  },
  {
    id: 'diligencia-cedula-papel',
    categoria: 'diligencia',
    tipos: ['cedula', 'mandamiento'],
    titulo: 'Resultado de cédula / mandamiento',
    descripcion: 'Cédula en papel: presentación, libramiento, retiro y diligenciamiento.',
    fields: [
      { path: 'diligencia.destinatario', label: 'Destinatario', type: 'text' },
      { path: 'diligencia.fechaLibramiento', label: 'Fecha libramiento', type: 'date' },
      { path: 'diligencia.fechaDiligenciamiento', label: 'Fecha diligenciamiento', type: 'date' },
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(CEDULA_NOTIF_ESTADOS_PAPEL),
      },
      {
        path: 'diligencia.resultado',
        label: 'Resultado',
        type: 'textarea',
        rows: 3,
        placeholder: 'Ej. Notificada / resultado negativo / domicilio inexistente',
      },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 2 },
    ],
  },
  {
    id: 'diligencia-cedula-electronica',
    categoria: 'diligencia',
    tipos: ['cedula_electronica'],
    titulo: 'Resultado de cédula electrónica',
    fields: [
      { path: 'diligencia.destinatario', label: 'Destinatario', type: 'text' },
      { path: 'diligencia.fechaLibramiento', label: 'Fecha libramiento / notificación', type: 'date' },
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(CEDULA_NOTIF_ESTADOS_ELECTRONICA),
      },
      {
        path: 'diligencia.resultado',
        label: 'Resultado',
        type: 'textarea',
        rows: 3,
      },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 2 },
    ],
  },
  {
    id: 'audiencia-realizada',
    categoria: 'audiencia',
    tipos: '*',
    titulo: 'Resultado de audiencia',
    descripcion: 'Acta, asistencia y resultado de la audiencia celebrada.',
    fields: [
      { path: 'audiencia.hora', label: 'Hora', type: 'text', placeholder: '10:30' },
      { path: 'audiencia.sala', label: 'Sala / juzgado', type: 'text' },
      { path: 'fechaProduccion', label: 'Fecha celebrada', type: 'date' },
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(AUDIENCIA_ESTADOS),
      },
      {
        path: 'audiencia.resultado',
        label: 'Resultado',
        type: 'textarea',
        rows: 3,
        placeholder: 'Ej. Se tomó declaración testimonial del testigo X',
      },
      {
        path: 'audiencia.actaTexto',
        label: 'Acta / notas',
        type: 'textarea',
        rows: 5,
      },
      { path: 'audiencia.cedulaNotificada', label: 'Cédula librada y notificada', type: 'boolean' },
    ],
  },
  {
    id: 'prueba-pericial',
    categoria: 'prueba',
    tipos: ['pericial'],
    titulo: 'Resultado pericial',
    fields: [
      { path: 'pericial.peritoDesignado', label: 'Perito designado', type: 'text' },
      { path: 'pericial.expedienteRogatoria', label: 'Expte. rogatoria', type: 'text' },
      {
        path: 'estado',
        label: 'Fase pericial',
        type: 'select',
        options: opts(PERICIAL_ESTADOS),
      },
      { path: 'fechaProduccion', label: 'Fecha dictamen / producción', type: 'date' },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 3 },
    ],
  },
  {
    id: 'prueba-documental',
    categoria: 'prueba',
    tipos: ['documental', 'documental_en_poder', 'informativa', 'inspeccion', 'otra'],
    titulo: 'Resultado de prueba',
    fields: [
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(PRUEBA_ESTADOS),
      },
      { path: 'fechaProduccion', label: 'Fecha producción', type: 'date' },
      { path: 'observaciones', label: 'Observaciones / resultado', type: 'textarea', rows: 4 },
    ],
  },
  {
    id: 'tramite-pericial',
    categoria: 'tramite',
    tipos: [
      'impugnacion_informe',
      'aclaracion_perito',
      'dictamen_complementario',
      'dictamen_pericial',
      'traslado_puntos',
    ],
    titulo: 'Resultado del trámite pericial',
    fields: [
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(ACLARACION_DICTAMEN_ESTADOS),
      },
      { path: 'fechaLimite', label: 'Plazo / fecha límite', type: 'date' },
      { path: 'fechaProduccion', label: 'Fecha presentación', type: 'date' },
      { path: 'observaciones', label: 'Observaciones', type: 'textarea', rows: 4 },
    ],
  },
  {
    id: 'mejor-proveer',
    categoria: 'mejor_proveer',
    tipos: '*',
    titulo: 'Cumplimiento de medida',
    fields: [
      {
        path: 'estado',
        label: 'Estado',
        type: 'select',
        options: opts(MEJOR_PROVEER_ESTADOS),
      },
      { path: 'fechaLimite', label: 'Plazo ordenado', type: 'date' },
      { path: 'fechaProduccion', label: 'Fecha cumplimiento', type: 'date' },
      { path: 'observaciones', label: 'Detalle / resultado', type: 'textarea', rows: 4 },
    ],
  },
  {
    id: 'generico',
    categoria: '*',
    tipos: '*',
    titulo: 'Registrar resultado',
    fields: [
      { path: 'fechaProduccion', label: 'Fecha', type: 'date' },
      { path: 'observaciones', label: 'Resultado / observaciones', type: 'textarea', rows: 4 },
    ],
  },
];

function entryMatches(entry: ParameterCatalogEntry, item: ControlPruebaItem): boolean {
  const cat = resolveCategoria(item);
  if (entry.categoria !== '*' && entry.categoria !== cat) return false;
  if (entry.tipos === '*') return true;
  return entry.tipos.includes(item.tipo);
}

/** Resuelve la definición de formulario para un ítem (más específica primero). */
export function resolveParameterCatalog(item: ControlPruebaItem): ParameterCatalogEntry {
  const cat = resolveCategoria(item);
  const tipo = item.tipo;

  const candidates = PARAMETER_CATALOG.filter((e) => e.id !== 'generico' && entryMatches(e, item));

  if (cat === 'diligencia' && (tipo === 'cedula' || tipo === 'mandamiento')) {
    const medio = getMedioCedulaNotificacion(item);
    const preferElectronica = medio === 'electronica';
    const preferId = preferElectronica ? 'diligencia-cedula-electronica' : 'diligencia-cedula-papel';
    const preferred = candidates.find((c) => c.id === preferId);
    if (preferred) return preferred;
  }

  if (cat === 'tramite' && esMovimientoPericial(item)) {
    const estados = estadosParaMovimientoPericial(item);
    const mov = candidates.find((c) => c.id === 'tramite-pericial');
    if (mov) {
      return {
        ...mov,
        fields: mov.fields.map((f) =>
          f.path === 'estado' ? { ...f, options: opts(estados, item) } : f,
        ),
      };
    }
  }

  if (cat === 'tramite' && item.tipo === 'impugnacion_informe') {
    const mov = candidates.find((c) => c.id === 'tramite-pericial');
    if (mov) {
      return {
        ...mov,
        fields: mov.fields.map((f) =>
          f.path === 'estado' ? { ...f, options: opts(IMPUGNACION_INFORME_ESTADOS, item) } : f,
        ),
      };
    }
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => {
      const specA = (a.categoria === '*' ? 0 : 2) + (a.tipos === '*' ? 0 : 1);
      const specB = (b.categoria === '*' ? 0 : 2) + (b.tipos === '*' ? 0 : 1);
      return specB - specA;
    })[0];
  }

  return PARAMETER_CATALOG.find((e) => e.id === 'generico')!;
}

export function getParameterValue(item: ControlPruebaItem, path: string): string | boolean {
  const parts = path.split('.');
  let cur: unknown = item;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur === 'boolean') return cur;
  return cur != null ? String(cur) : '';
}

function setNested(
  target: Record<string, unknown>,
  parts: string[],
  value: string | boolean | null,
): void {
  if (parts.length === 1) {
    target[parts[0]!] = value;
    return;
  }
  const [head, ...rest] = parts;
  const prev = (target[head!] as Record<string, unknown> | undefined) ?? {};
  target[head!] = { ...prev };
  setNested(target[head!] as Record<string, unknown>, rest, value);
}

/** Convierte valores del formulario en patch parcial del ítem. */
export function patchFromParameterValues(
  item: ControlPruebaItem,
  values: Record<string, string | boolean>,
): Partial<ControlPruebaItem> {
  const patch: Record<string, unknown> = {};

  for (const [path, raw] of Object.entries(values)) {
    const field = resolveParameterCatalog(item).fields.find((f) => f.path === path);
    let value: string | boolean | null;
    if (field?.type === 'boolean') {
      value = raw === true || raw === 'true';
    } else if (field?.type === 'date' || field?.type === 'text' || field?.type === 'textarea' || field?.type === 'select') {
      const s = String(raw ?? '').trim();
      value = s || null;
    } else {
      value = raw === '' ? null : raw;
    }
    setNested(patch, path.split('.'), value);
  }

  return patch as Partial<ControlPruebaItem>;
}

/** Indica si el ítem ya tiene algún dato de resultado cargado. */
export function tieneResultadoCargado(item: ControlPruebaItem): boolean {
  const entry = resolveParameterCatalog(item);
  return entry.fields.some((f) => {
    const v = getParameterValue(item, f.path);
    if (f.type === 'boolean') return v === true;
    return String(v).trim().length > 0;
  });
}
