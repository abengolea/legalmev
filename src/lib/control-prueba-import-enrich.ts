import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';
import type { ControlItemEstado, ControlPruebaItem } from '@/types/control-prueba';
import {
  AUDIENCIA_ESTADOS,
  DILIGENCIA_ESTADOS,
  INFORMATIVA_ESTADOS,
  MEJOR_PROVEER_ESTADOS,
  OFICIO_ELECTRONICO_ESTADOS,
  PERICIAL_ESTADOS,
  PRUEBA_ESTADOS,
  CEDULA_NOTIF_ESTADOS_ELECTRONICA,
  CEDULA_NOTIF_ESTADOS_PAPEL,
} from '@/types/control-prueba';
import { evaluarSubProcesosAutomaticos } from '@/lib/control-prueba-subprocesos';
import { constaDesistimientoPrueba } from '@/lib/control-prueba-cierre';

const ESTADOS_PRUEBA_IMPORT = new Set<string>(PRUEBA_ESTADOS);
const ESTADOS_PERICIAL_IMPORT = new Set<string>(PERICIAL_ESTADOS);
const ESTADOS_INFORMATIVA_IMPORT = new Set<string>(INFORMATIVA_ESTADOS);
const ESTADOS_DILIGENCIA_IMPORT = new Set<string>([
  ...DILIGENCIA_ESTADOS,
  ...CEDULA_NOTIF_ESTADOS_PAPEL,
  ...CEDULA_NOTIF_ESTADOS_ELECTRONICA,
  ...OFICIO_ELECTRONICO_ESTADOS,
]);
const ESTADOS_AUDIENCIA_IMPORT = new Set<string>(AUDIENCIA_ESTADOS);
const ESTADOS_MEJOR_PROVEER_IMPORT = new Set<string>(MEJOR_PROVEER_ESTADOS);

/** Negación / impugnación de autenticidad sobre documental acompañada. */
export function constaImpugnacionAutenticidad(desc: string, obs?: string | null): boolean {
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\bse\s+niega\s+la\s+autenticidad\b/i.test(t) ||
    /\bniega\s+documental\b/i.test(t) ||
    /\bexpidan\s+sobre\s+su\s+autenticidad\b/i.test(t) ||
    /\bniego\s+por\s+no\s+constarme\s+su\s+autenticidad\b/i.test(t) ||
    /\b(impugn|niega|negativ).{0,50}(autenticidad|autentic)\b/i.test(t) ||
    /\bautenticidad.{0,50}(impugn|negad|negativ)/i.test(t) ||
    /\bno\s+reconoc(e|e\s).{0,40}(autenticidad|firma|document)/i.test(t) ||
    /\boposiciones?.{0,30}documental.{0,80}niega/i.test(t)
  );
}

/** Intimación ordenada para exhibir documentación en poder de contraparte. */
export function constaIntimacionDocumental(desc: string, obs?: string | null): boolean {
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\bintim(a|e|ación|ar|ado).{0,60}(exhib|acompañ|present|aport).{0,40}(document|docum)/i.test(t) ||
    /\borden(a|ar).{0,40}intimaci[oó]n.{0,50}(document|exhib)/i.test(t) ||
    /\bplazo.{0,30}(exhib|acompañ|present).{0,30}(document|docum)/i.test(t)
  );
}

/** Exhibición parcial de documental intimada. */
export function constaExhibicionParcial(desc: string, obs?: string | null): boolean {
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\bexhibici[oó]n\s+parcial\b/i.test(t) ||
    /\bacompa[nñ](a|ó|aron).{0,50}parcial\b/i.test(t) ||
    /\b(falta|faltan|faltantes?).{0,40}(document|pieza|instrumento)/i.test(t) ||
    /\bparcialmente\s+(acompa[nñ]|exhib|present)/i.test(t)
  );
}

/** Apercibimiento / no acompañaron documental intimada. */
export function constaApercibimientoDocumental(desc: string, obs?: string | null): boolean {
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\bapercibimiento\b/i.test(t) ||
    /\bno\s+acompa[nñ](a|ó|aron).{0,50}(document|plazo|intim)/i.test(t) ||
    /\bincumpl(i[oó]|imiento).{0,40}(intimaci|exhib|acompa[nñ])/i.test(t) ||
    /\bsin\s+acompa[nñ]ar\b/i.test(t)
  );
}

/** Audiencia de prueba ya fijada (confesional/testimonial). */
export function constaAudienciaFijada(desc: string, obs?: string | null, fechaLimite?: string | null): boolean {
  if (fechaLimite?.trim()) {
    const t = `${desc} ${obs ?? ''}`;
    if (/\b(fij|design|se[nñ]al|convoc).{0,40}(audiencia|confesional|testimonial)/i.test(t)) return true;
    if (/\baudiencia\b/i.test(t)) return true;
  }
  const t = `${desc} ${obs ?? ''}`;
  return (
    /\baudiencia\s+(fijada|designada|se[nñ]alada|convocada)\b/i.test(t) ||
    /\b(fij|design|se[nñ]al).{0,30}audiencia\b/i.test(t) ||
    /\bpara\s+el\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}.{0,40}audiencia\b/i.test(t)
  );
}

/** Acompañamiento documental durante el trámite (no es prueba ofrecida en apertura). */
export function esProduccionDocumentalTramite(descripcion: string): boolean {
  const d = descripcion.trim();
  if (!/\b(actor|demandad|parte).{0,25}acompañ(a|ó|e)\b/i.test(d)) return false;
  if (/\b(en poder de|ofrecid|admitid).{0,40}apertura\b/i.test(d)) return false;
  return /\b(anexo|informe de consultora|contestaci[oó]n de oficio|documentaci[oó]n acompañad)\b/i.test(d);
}

function normalizarParaMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similitudDescripcion(a: string, b: string): number {
  const na = normalizarParaMatch(a);
  const nb = normalizarParaMatch(b);
  if (!na || !nb) return 0;
  if (na === nb || na.includes(nb) || nb.includes(na)) return 1;
  const wa = new Set(na.split(' ').filter((w) => w.length > 3));
  const wb = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return inter / Math.max(wa.size, wb.size);
}

function sugerenciaEnSet(sug: string | undefined, set: Set<string>): ControlItemEstado | undefined {
  if (sug && set.has(sug)) return sug as ControlItemEstado;
  return undefined;
}

export function resolveEstadoImport(
  raw: ControlPruebaImportOutput['items'][number],
  categoria: string,
  tipo: string,
): ControlItemEstado | undefined {
  const sug = raw.estadoSugerido;
  // Compat: informativa vieja usaba contestado/cumplido → producida
  const sugNorm =
    tipo === 'informativa' && (sug === 'contestado' || sug === 'cumplido') ? 'producida' : sug;

  if (categoria === 'prueba' && tipo === 'documental') {
    if (raw.impugnacionAutenticidad || constaImpugnacionAutenticidad(raw.descripcion, raw.observaciones)) {
      return 'autenticidad_impugnada';
    }
    // Documental ya acompañada sin impugnación → producida (obra en autos).
    // Sobrescribe pendiente_produccion si la IA lo dejó por defecto.
    if (!sugNorm || sugNorm === 'pendiente_produccion') {
      return 'producida';
    }
    return sugerenciaEnSet(sugNorm, ESTADOS_PRUEBA_IMPORT);
  }

  if (categoria === 'prueba' && tipo === 'documental_en_poder') {
    if (sugNorm === 'apercibimiento_en_contra' || constaApercibimientoDocumental(raw.descripcion, raw.observaciones)) {
      return 'apercibimiento_en_contra';
    }
    if (sugNorm === 'exhibicion_parcial' || constaExhibicionParcial(raw.descripcion, raw.observaciones)) {
      return 'exhibicion_parcial';
    }
    if (
      sugNorm === 'intimacion_ordenada' ||
      raw.intimacionOrdenada ||
      constaIntimacionDocumental(raw.descripcion, raw.observaciones)
    ) {
      return 'intimacion_ordenada';
    }
    return sugerenciaEnSet(sugNorm, ESTADOS_PRUEBA_IMPORT);
  }

  if (categoria === 'prueba' && (tipo === 'confesional' || tipo === 'testimonial')) {
    if (constaDesistimientoPrueba(raw.descripcion, raw.observaciones)) {
      return 'desistida';
    }
    if (
      sugNorm === 'audiencia_fijada' ||
      constaAudienciaFijada(raw.descripcion, raw.observaciones, raw.fechaLimite)
    ) {
      return 'audiencia_fijada';
    }
    return sugerenciaEnSet(sugNorm, ESTADOS_PRUEBA_IMPORT);
  }

  if (categoria === 'prueba' && tipo === 'informativa') {
    if (constaDesistimientoPrueba(raw.descripcion, raw.observaciones)) {
      return 'desistida';
    }
    return sugerenciaEnSet(sugNorm, ESTADOS_INFORMATIVA_IMPORT);
  }

  if (categoria === 'prueba' && tipo === 'pericial') {
    return sugerenciaEnSet(sugNorm, ESTADOS_PERICIAL_IMPORT);
  }

  if (categoria === 'diligencia') {
    // Incluye estados genéricos + cédula/oficio electrónico (unión en ESTADOS_DILIGENCIA_IMPORT).
    return sugerenciaEnSet(sugNorm, ESTADOS_DILIGENCIA_IMPORT);
  }

  if (categoria === 'audiencia') {
    if (sugNorm === 'audiencia_fijada') return 'programada';
    return sugerenciaEnSet(sugNorm, ESTADOS_AUDIENCIA_IMPORT);
  }

  if (categoria === 'mejor_proveer') {
    return sugerenciaEnSet(sugNorm, ESTADOS_MEJOR_PROVEER_IMPORT);
  }

  if (sugNorm && ESTADOS_PRUEBA_IMPORT.has(sugNorm)) {
    return sugNorm as ControlItemEstado;
  }

  if (categoria === 'prueba' && constaDesistimientoPrueba(raw.descripcion, raw.observaciones)) {
    return 'desistida';
  }

  return undefined;
}

/** Vincula diligencias (oficios) con destinatario según campo IA `oficioVinculadoA`.
 *  También completa destinatario en prueba informativa originaria. */
export function vincularDiligenciasImport(
  items: ControlPruebaItem[],
  rawItems: ControlPruebaImportOutput['items'],
): ControlPruebaItem[] {
  return items.map((item, idx): ControlPruebaItem => {
    const raw = rawItems[idx];
    const destRaw = raw?.destinatarioOficio?.trim();

    if (item.tipo === 'informativa' && (item.categoria ?? 'prueba') === 'prueba') {
      if (!destRaw && !item.diligencia) return item;
      return {
        ...item,
        diligencia: {
          ...(item.diligencia ?? {}),
          destinatario: destRaw || item.diligencia?.destinatario,
          objeto: item.diligencia?.objeto ?? item.descripcion,
          plazoContestacion: item.diligencia?.plazoContestacion ?? item.fechaLimite ?? null,
        },
      };
    }

    if ((item.categoria ?? 'prueba') !== 'diligencia') return item;
    const ref = raw?.oficioVinculadoA?.trim();
    const baseDiligencia = item.diligencia ?? {
      objeto: item.descripcion,
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      plazoContestacion: item.fechaLimite ?? null,
    };

    if (!ref) {
      const dest = destRaw;
      if (dest) {
        return {
          ...item,
          diligencia: { ...baseDiligencia, destinatario: dest, objeto: baseDiligencia.objeto ?? item.descripcion },
        };
      }
      return item;
    }

    const documentales = items.filter(
      (i) => (i.categoria ?? 'prueba') === 'prueba' && i.tipo === 'documental',
    );
    let mejor: ControlPruebaItem | undefined;
    let mejorScore = 0.45;
    for (const p of documentales) {
      const score = similitudDescripcion(ref, p.descripcion);
      if (score > mejorScore) {
        mejorScore = score;
        mejor = p;
      }
    }

    if (!mejor) {
      const dest = destRaw;
      if (dest) {
        return {
          ...item,
          diligencia: { ...baseDiligencia, destinatario: dest, objeto: baseDiligencia.objeto ?? ref },
        };
      }
      return item;
    }

    return {
      ...item,
      diligencia: {
        ...baseDiligencia,
        destinatario: destRaw || baseDiligencia.destinatario,
        objeto: baseDiligencia.objeto ?? ref,
        pruebaVinculadaId: mejor.id,
      },
      vinculo: item.vinculo ?? {
        parentItemId: mejor.id,
        parentTipo: 'documental',
        parentCategoria: 'prueba',
        rol: 'oficio_autenticidad',
        autoCreated: false,
        vinculoLabel: `Oficio — ${destRaw || ref.slice(0, 40)}`,
        triggerKey: `import_oficio|${item.id}|${mejor.id}`,
      },
    };
  });
}

/** Dispara subprocesos automáticos para estados complejos detectados en el import. */
export function aplicarSubprocesosPostImport(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let result = items;

  for (const item of items) {
    const cat = item.categoria ?? 'prueba';

    if (item.tipo === 'documental' && item.estado === 'autenticidad_impugnada') {
      const r = evaluarSubProcesosAutomaticos({
        items: result,
        itemId: item.id,
        itemAnterior: { ...item, estado: 'pendiente_produccion' },
        patch: { estado: 'autenticidad_impugnada' },
      });
      result = r.items;
      continue;
    }

    if (
      item.tipo === 'documental_en_poder' &&
      (item.estado === 'intimacion_ordenada' ||
        item.estado === 'exhibicion_parcial' ||
        item.estado === 'apercibimiento_en_contra')
    ) {
      const r = evaluarSubProcesosAutomaticos({
        items: result,
        itemId: item.id,
        itemAnterior: { ...item, estado: 'pendiente_produccion' },
        patch: { estado: item.estado },
      });
      result = r.items;
      continue;
    }

    if (
      cat === 'prueba' &&
      (item.tipo === 'confesional' || item.tipo === 'testimonial') &&
      item.estado === 'audiencia_fijada'
    ) {
      const r = evaluarSubProcesosAutomaticos({
        items: result,
        itemId: item.id,
        itemAnterior: { ...item, estado: 'pendiente_produccion' },
        patch: { estado: 'audiencia_fijada' },
      });
      result = r.items;
    }
  }

  return result;
}

export function enriquecerItemsImportados(
  items: ControlPruebaItem[],
  rawItems: ControlPruebaImportOutput['items'],
): ControlPruebaItem[] {
  const vinculados = vincularDiligenciasImport(items, rawItems);
  return aplicarSubprocesosPostImport(vinculados);
}
