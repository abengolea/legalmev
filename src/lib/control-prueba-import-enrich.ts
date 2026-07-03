import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';
import type { ControlItemEstado, ControlPruebaItem } from '@/types/control-prueba';
import { evaluarSubProcesosAutomaticos } from '@/lib/control-prueba-subprocesos';
import { constaDesistimientoPrueba } from '@/lib/control-prueba-cierre';

const ESTADOS_PRUEBA_IMPORT = new Set<string>([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'autenticidad_impugnada',
  'valoracion_judicial',
  'producida',
  'desistida',
  'no_admitida',
]);

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

export function resolveEstadoImport(
  raw: ControlPruebaImportOutput['items'][number],
  categoria: string,
  tipo: string,
): ControlItemEstado | undefined {
  const sug = raw.estadoSugerido;
  if (sug && ESTADOS_PRUEBA_IMPORT.has(sug)) {
    return sug as ControlItemEstado;
  }

  if (categoria === 'prueba' && tipo === 'documental') {
    if (raw.impugnacionAutenticidad || constaImpugnacionAutenticidad(raw.descripcion, raw.observaciones)) {
      return 'autenticidad_impugnada';
    }
  }

  if (categoria === 'prueba' && tipo === 'documental_en_poder') {
    if (raw.intimacionOrdenada || constaIntimacionDocumental(raw.descripcion, raw.observaciones)) {
      return 'intimacion_ordenada';
    }
  }

  if (
    categoria === 'prueba' ||
    (categoria === 'audiencia' && (tipo === 'confesional' || tipo === 'testimonial'))
  ) {
    if (constaDesistimientoPrueba(raw.descripcion, raw.observaciones)) {
      return 'desistida';
    }
  }

  return undefined;
}

/** Vincula diligencias (oficios) con destinatario según campo IA `oficioVinculadoA`. */
export function vincularDiligenciasImport(
  items: ControlPruebaItem[],
  rawItems: ControlPruebaImportOutput['items'],
): ControlPruebaItem[] {
  return items.map((item, idx): ControlPruebaItem => {
    if ((item.categoria ?? 'prueba') !== 'diligencia') return item;
    const raw = rawItems[idx];
    const ref = raw?.oficioVinculadoA?.trim();
    const baseDiligencia = item.diligencia ?? {
      objeto: item.descripcion,
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      plazoContestacion: item.fechaLimite ?? null,
    };

    if (!ref) {
      const dest = raw?.destinatarioOficio?.trim();
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
      const dest = raw?.destinatarioOficio?.trim();
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
        destinatario: raw?.destinatarioOficio?.trim() || baseDiligencia.destinatario,
        objeto: baseDiligencia.objeto ?? ref,
        pruebaVinculadaId: mejor.id,
      },
      vinculo: item.vinculo ?? {
        parentItemId: mejor.id,
        parentTipo: 'documental',
        parentCategoria: 'prueba',
        rol: 'oficio_autenticidad',
        autoCreated: false,
        vinculoLabel: `Oficio — ${raw?.destinatarioOficio?.trim() || ref.slice(0, 40)}`,
        triggerKey: `import_oficio|${item.id}|${mejor.id}`,
      },
    };
  });
}

/** Dispara subprocesos automáticos para estados complejos detectados en el import. */
export function aplicarSubprocesosPostImport(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let result = items;

  for (const item of items) {
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

    if (item.tipo === 'documental_en_poder' && item.estado === 'intimacion_ordenada') {
      const r = evaluarSubProcesosAutomaticos({
        items: result,
        itemId: item.id,
        itemAnterior: { ...item, estado: 'pendiente_produccion' },
        patch: { estado: 'intimacion_ordenada' },
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
