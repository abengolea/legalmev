import type {
  ControlPruebaItem,
  ConstatacionJudicialModo,
  ResolucionAutenticidadDocumental,
  SubprocesoVinculo,
} from '@/types/control-prueba';
import { resolveCategoria } from '@/lib/control-prueba';
import { requiereFlujoAutenticidadDocumental } from '@/lib/control-prueba-documental-autenticidad';
import { esOficioAutenticidadDocumental } from '@/lib/control-prueba-documental-poder';

export const TIPO_CONSTATACION_JUDICIAL = 'constatacion_judicial' as const;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textoContextoAutenticidadDocumental(item: ControlPruebaItem): string {
  const parts = [
    item.descripcion,
    item.observaciones,
    item.documental?.destinatarioOficio,
    ...(item.documental?.oficiosAutenticidad ?? []).map(
      (o) => `${o.destinatarioOficio} ${o.objetoOficio ?? ''} ${o.observaciones ?? ''}`,
    ),
  ];
  return parts.filter(Boolean).join(' · ');
}

export function indicaContenidoWebOCaptura(texto: string): boolean {
  return /\b(p[aá]gina\s+web|sitio\s+web|website|url\b|https?:\/\/|www\.|captura\s+de\s+pantalla|pantallazo|print\s+de\s+pantalla)\b/i.test(
    texto,
  );
}

export function indicaConstatacionJudicial(texto: string): boolean {
  return (
    /\bconstataci[oó]n\s+judicial\b/i.test(texto) ||
    /\bactuario\b.*\bconstat/i.test(texto) ||
    /\bconstat.*\bactuario\b/i.test(texto) ||
    /\bse\s+ofrece\b.*\bactuario\b/i.test(texto) ||
    /\bel\s+actuario\b.*\b(realice|proceda|constat)/i.test(texto) ||
    /\bmismo\s+juzgado\b/i.test(texto)
  );
}

export function indicaDelegacionConstatacion(texto: string): boolean {
  return (
    /\b(mandamiento|oficio\s+(de\s+)?justicia|juez\s+delegado|juzgado\s+delegado|delegad[oa]\s+en|sede\s+oficiada)\b/i.test(
      texto,
    ) && /\bconstat/i.test(texto)
  );
}

/** Destinatario que no es un tercero oficiado (banco, empresa…) sino el propio tribunal/actuario. */
export function esDestinatarioInternoConstatacion(destinatario: string): boolean {
  const d = norm(destinatario);
  if (!d) return false;
  if (d === 'oficiado') return true;
  return /^(actuario|secretar[ií]a|tribunal|juzgado|mismo juzgado|este juzgado)/.test(d);
}

export function esDestinatarioOficioAutenticidadExterno(destinatario: string): boolean {
  const d = norm(destinatario);
  if (!d) return false;
  if (esDestinatarioInternoConstatacion(destinatario)) return false;
  if (/andreani|banco|registro|afip|correo|empresa|\bs\.?\s*a\.?\b|\bsrl\b|\bs\.?\s*r\.?\s*l\.?\b/.test(d)) {
    return true;
  }
  return d.length > 2;
}

export function inferirModoConstatacionJudicial(
  item: Pick<ControlPruebaItem, 'descripcion' | 'observaciones' | 'constatacionJudicial'>,
  contextoExtra = '',
): ConstatacionJudicialModo {
  const explicit = item.constatacionJudicial?.modo;
  if (explicit === 'directa' || explicit === 'delegada') return explicit;
  const ctx = `${item.descripcion} ${item.observaciones ?? ''} ${contextoExtra}`;
  if (indicaDelegacionConstatacion(ctx)) return 'delegada';
  return 'directa';
}

export function inferirResolucionAutenticidadDocumental(
  item: ControlPruebaItem,
): ResolucionAutenticidadDocumental {
  const prev = item.documental?.resolucionAutenticidad;
  if (prev === 'oficio_externo' || prev === 'constatacion_judicial') return prev;

  const ctx = textoContextoAutenticidadDocumental(item);
  if (indicaConstatacionJudicial(ctx)) return 'constatacion_judicial';

  if (indicaContenidoWebOCaptura(ctx)) {
    const dest = item.documental?.destinatarioOficio?.trim() ?? '';
    if (!dest || esDestinatarioInternoConstatacion(dest)) return 'constatacion_judicial';
    if (!esDestinatarioOficioAutenticidadExterno(dest)) return 'constatacion_judicial';
  }

  return 'oficio_externo';
}

export function esConstatacionJudicialVinculada(item: ControlPruebaItem): boolean {
  return (
    (item.categoria ?? 'prueba') === 'prueba' &&
    item.tipo === TIPO_CONSTATACION_JUDICIAL &&
    item.vinculo?.rol === 'constatacion_judicial_vinculada'
  );
}

export function esMandamientoConstatacion(item: ControlPruebaItem): boolean {
  return (
    resolveCategoria(item) === 'diligencia' &&
    item.tipo === 'mandamiento' &&
    item.vinculo?.rol === 'mandamiento_constatacion'
  );
}

export function esOficioJusticiaConstatacion(item: ControlPruebaItem): boolean {
  return (
    resolveCategoria(item) === 'diligencia' &&
    (item.tipo === 'oficio' || item.tipo === 'oficio_electronico') &&
    item.vinculo?.rol === 'oficio_justicia_constatacion'
  );
}

export function constatacionesJudicialesDeDocumental(
  items: ControlPruebaItem[],
  documentalId: string,
): ControlPruebaItem[] {
  return items.filter(
    (i) =>
      esConstatacionJudicialVinculada(i) &&
      (i.vinculo?.parentItemId === documentalId ||
        i.constatacionJudicial?.documentalVinculadaId === documentalId),
  );
}

export function diligenciasDelegacionConstatacion(
  items: ControlPruebaItem[],
  constatacionId: string,
): ControlPruebaItem[] {
  return items.filter(
    (i) =>
      (esMandamientoConstatacion(i) || esOficioJusticiaConstatacion(i)) &&
      (i.vinculo?.parentItemId === constatacionId || i.diligencia?.pruebaVinculadaId === constatacionId),
  );
}

function triggerKeyConstatacionVinculada(documentalId: string): string {
  return `constatacion_judicial|${documentalId}`;
}

function triggerKeyMandamientoConstatacion(constatacionId: string, dest: string): string {
  return `mandamiento_constatacion|${constatacionId}|${norm(dest).slice(0, 40)}`;
}

function extraerJuzgadoDelegado(texto: string): string | null {
  const m =
    texto.match(
      /(?:juzgado|juez)\s+(?:delegado\s+)?(?:en\s+)?([^·.\n,]{4,80})/i,
    ) ??
    texto.match(/mandamiento\s+(?:a\s+)?([^·.\n,]{4,80})/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  if (raw.split(/\s+/).length > 10) return raw.split(/\s+/).slice(0, 8).join(' ');
  return raw;
}

export function buildConstatacionJudicialVinculada(
  documental: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number },
): ControlPruebaItem {
  const ctx = textoContextoAutenticidadDocumental(documental);
  const modo = inferirModoConstatacionJudicial(documental, ctx);
  const tk = opts.triggerKey ?? triggerKeyConstatacionVinculada(documental.id);

  const vinculo: SubprocesoVinculo = {
    parentItemId: documental.id,
    parentTipo: 'documental',
    parentCategoria: 'prueba',
    rol: 'constatacion_judicial_vinculada',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel:
      modo === 'delegada'
        ? 'Constatación judicial (delegada)'
        : 'Constatación judicial vinculada',
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'prueba',
    tipo: TIPO_CONSTATACION_JUDICIAL,
    descripcion: `Constatación judicial — ${documental.descripcion.slice(0, 120)}`,
    ofrecidaPor: documental.ofrecidaPor ?? 'actor',
    estado: 'pendiente_produccion',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    constatacionJudicial: {
      modo,
      documentalVinculadaId: documental.id,
      objeto: documental.descripcion,
      juzgadoDelegado:
        modo === 'delegada'
          ? extraerJuzgadoDelegado(ctx) ??
            documental.documental?.destinatarioOficio?.trim() ??
            null
          : null,
    },
  };
}

export function buildMandamientoConstatacionDelegada(
  constatacion: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number; destinatario?: string },
): ControlPruebaItem {
  const ctx = `${constatacion.descripcion} ${constatacion.observaciones ?? ''}`;
  const dest =
    opts.destinatario?.trim() ||
    constatacion.constatacionJudicial?.juzgadoDelegado?.trim() ||
    extraerJuzgadoDelegado(ctx) ||
    'Juzgado delegado';
  const tk = opts.triggerKey ?? triggerKeyMandamientoConstatacion(constatacion.id, dest);

  const vinculo: SubprocesoVinculo = {
    parentItemId: constatacion.id,
    parentTipo: 'constatacion_judicial',
    parentCategoria: 'prueba',
    rol: 'mandamiento_constatacion',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Mandamiento — constatación (${dest})`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'mandamiento',
    descripcion: `Mandamiento / oficio de justicia — constatación judicial`,
    ofrecidaPor: 'tribunal',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    diligencia: {
      destinatario: dest,
      objeto: `Diligenciar constatación judicial: ${constatacion.descripcion.slice(0, 160)}`,
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      pruebaVinculadaId: constatacion.id,
    },
  };
}

function patchDocumentalResolucionConstatacion(documental: ControlPruebaItem): ControlPruebaItem {
  return {
    ...documental,
    documental: {
      ...(documental.documental ?? {}),
      resolucionAutenticidad: 'constatacion_judicial',
      oficiosAutenticidad: [],
      destinatarioOficio: documental.documental?.destinatarioOficio ?? null,
    },
  };
}

function eliminarOficiosAutenticidadAutoDeDocumental(
  items: ControlPruebaItem[],
  documentalId: string,
): ControlPruebaItem[] {
  return items.filter((i) => {
    if (!esOficioAutenticidadDocumental(i)) return true;
    const padre = i.vinculo?.parentItemId ?? i.diligencia?.pruebaVinculadaId;
    if (padre !== documentalId) return true;
    return !i.vinculo?.autoCreated;
  });
}

function eliminarConstatacionVinculadaDeDocumental(
  items: ControlPruebaItem[],
  documentalId: string,
): ControlPruebaItem[] {
  const constataciones = constatacionesJudicialesDeDocumental(items, documentalId);
  const dropIds = new Set<string>();
  for (const c of constataciones) {
    dropIds.add(c.id);
    for (const d of diligenciasDelegacionConstatacion(items, c.id)) {
      dropIds.add(d.id);
    }
  }
  if (dropIds.size === 0) return items;
  return items.filter((i) => !dropIds.has(i.id));
}

export type ConstatacionVinculosResult = {
  items: ControlPruebaItem[];
  creados: ControlPruebaItem[];
  alertas: string[];
};

export function ensureVinculosConstatacionJudicialDocumental(
  items: ControlPruebaItem[],
  documentalId: string,
): ConstatacionVinculosResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let working = eliminarOficiosAutenticidadAutoDeDocumental([...items], documentalId);

  const docIdx = working.findIndex((i) => i.id === documentalId);
  const documental = docIdx >= 0 ? working[docIdx] : undefined;
  if (
    !documental ||
    !requiereFlujoAutenticidadDocumental(documental.tipo) ||
    documental.estado !== 'autenticidad_impugnada'
  ) {
    return { items: working, creados, alertas };
  }

  if (docIdx >= 0) {
    working[docIdx] = patchDocumentalResolucionConstatacion(documental);
  }

  const tk = triggerKeyConstatacionVinculada(documentalId);
  let constatacion = constatacionesJudicialesDeDocumental(working, documentalId)[0];
  if (!constatacion && !working.some((i) => i.vinculo?.triggerKey === tk)) {
    constatacion = buildConstatacionJudicialVinculada(working[docIdx]!, {
      autoCreated: true,
      triggerKey: tk,
      orden: working.length + creados.length + 1,
    });
    working = [...working, constatacion];
    creados.push(constatacion);
    alertas.push('Se creó prueba de constatación judicial vinculada (no oficio externo).');
  }

  if (!constatacion) {
    constatacion = constatacionesJudicialesDeDocumental(working, documentalId)[0];
  }

  if (constatacion && inferirModoConstatacionJudicial(constatacion) === 'delegada') {
    const dest =
      constatacion.constatacionJudicial?.juzgadoDelegado?.trim() ||
      extraerJuzgadoDelegado(textoContextoAutenticidadDocumental(documental)) ||
      'Juzgado delegado';
    const yaHay = diligenciasDelegacionConstatacion(working, constatacion.id).some(
      (d) => norm(d.diligencia?.destinatario ?? '') === norm(dest),
    );
    const tkM = triggerKeyMandamientoConstatacion(constatacion.id, dest);
    if (!yaHay && !working.some((i) => i.vinculo?.triggerKey === tkM)) {
      const mand = buildMandamientoConstatacionDelegada(constatacion, {
        autoCreated: true,
        triggerKey: tkM,
        orden: working.length + creados.length + 1,
        destinatario: dest,
      });
      working = [...working, mand];
      creados.push(mand);
      alertas.push('Se creó mandamiento para constatación delegada.');
    }
  }

  return { items: working, creados, alertas };
}

/** Corrige oficios auto-creados cuando correspondía constatación judicial. */
export function repararAutenticidadDocumentalSubprocesos(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let working = items;
  for (const item of items) {
    if (item.tipo !== 'documental' || item.estado !== 'autenticidad_impugnada') continue;
    if (inferirResolucionAutenticidadDocumental(item) !== 'constatacion_judicial') continue;
    working = ensureVinculosConstatacionJudicialDocumental(working, item.id).items;
  }
  return working;
}

export function eliminarSubprocesosConstatacionDeDocumental(
  items: ControlPruebaItem[],
  documentalId: string,
): ControlPruebaItem[] {
  return eliminarConstatacionVinculadaDeDocumental(items, documentalId);
}

export function ensureDelegacionConstatacionJudicial(
  items: ControlPruebaItem[],
  constatacionId: string,
): ConstatacionVinculosResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  const padre = items.find((i) => i.id === constatacionId);
  if (!padre || padre.tipo !== TIPO_CONSTATACION_JUDICIAL) {
    return { items, creados, alertas };
  }
  if (inferirModoConstatacionJudicial(padre) !== 'delegada') {
    return { items, creados, alertas };
  }
  const dest =
    padre.constatacionJudicial?.juzgadoDelegado?.trim() ||
    extraerJuzgadoDelegado(`${padre.descripcion} ${padre.observaciones ?? ''}`) ||
    'Juzgado delegado';
  const yaHay = diligenciasDelegacionConstatacion(items, padre.id).length > 0;
  const tkM = triggerKeyMandamientoConstatacion(padre.id, dest);
  if (yaHay || items.some((i) => i.vinculo?.triggerKey === tkM)) {
    return { items, creados, alertas };
  }
  const mand = buildMandamientoConstatacionDelegada(padre, {
    autoCreated: true,
    triggerKey: tkM,
    orden: items.length + 1,
    destinatario: dest,
  });
  alertas.push('Se creó mandamiento para constatación delegada.');
  return { items: [...items, mand], creados: [mand], alertas };
}
