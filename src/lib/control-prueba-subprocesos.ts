import type {
  ControlPruebaItem,
  ItemCategoria,
  ParentTipoSubproceso,
  SubprocesoRol,
  SubprocesoVinculo,
  CedulaNotificacionPruebaLegacy,
} from '@/types/control-prueba';
import { esConfesional, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import { requiereAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import {
  labelParteConDocumentos,
  parteContrariaDefault,
  requiereFlujoDocumentalEnPoder,
} from '@/lib/control-prueba-documental-poder';
import { requiereFlujoAutenticidadDocumental } from '@/lib/control-prueba-documental-autenticidad';
import type { CedulaNotifMedio } from '@/types/control-prueba';
import { restarDiasHabiles } from '@/lib/control-prueba-plazos';

const DIAS_ANTES_AUDIENCIA_CEDULA = 10;
const DIAS_ANTES_PLAZO_PRESENTACION_CEDULA = 5;

export type SubprocesoEvalContext = {
  items: ControlPruebaItem[];
  itemId: string;
  itemAnterior: ControlPruebaItem;
  patch: Partial<ControlPruebaItem>;
  usuario?: string;
};

export type SubprocesoEvalResult = {
  items: ControlPruebaItem[];
  creados: ControlPruebaItem[];
  alertas: string[];
};

/** Índice parentId → hijos vinculados (O(n), una pasada). */
export function buildHijosIndex(items: ControlPruebaItem[]): Map<string, ControlPruebaItem[]> {
  const map = new Map<string, ControlPruebaItem[]>();
  for (const item of items) {
    const parentId = item.vinculo?.parentItemId;
    if (!parentId) continue;
    const list = map.get(parentId) ?? [];
    list.push(item);
    map.set(parentId, list);
  }
  return map;
}

export function hijosDePadre(parentId: string, items: ControlPruebaItem[]): ControlPruebaItem[] {
  return items.filter((i) => i.vinculo?.parentItemId === parentId);
}

export function parentTipoDeItem(item: ControlPruebaItem): ParentTipoSubproceso | null {
  if (esConfesional(item) || item.tipo === 'confesional') return 'confesional';
  if (item.tipo === 'testimonial' || item.tipo === 'audiencia_testimonial') return 'testimonial';
  if (item.tipo === 'pericial') return 'pericial';
  if (item.tipo === 'informativa') return 'informativa';
  if (item.tipo === 'documental_en_poder') return 'documental_en_poder';
  if (item.tipo === 'documental') return 'documental';
  return null;
}

export function esPadreSubprocesos(item: ControlPruebaItem): boolean {
  return (
    parentTipoDeItem(item) !== null &&
    (requiereAudienciaPrueba(item.tipo) ||
      item.tipo === 'pericial' ||
      item.tipo === 'informativa' ||
      requiereFlujoDocumentalEnPoder(item.tipo))
  );
}

function triggerKeyCedula(parentId: string, destinatario: string, fecha: string, hora: string): string {
  const dest = destinatario.trim() || '_default';
  return `cedula_audiencia|${parentId}|${dest}|${fecha}|${hora}`;
}

function mapEstadoCedulaLegacyAEmbedded(estado: CedulaNotificacionPruebaLegacy['estado']): string {
  switch (estado) {
    case 'librada':
      return 'librada';
    case 'notificada':
      return 'notificada';
    case 'negativa':
      return 'resultado_negativo';
    case 'sin_efecto':
      return 'resultado_negativo';
    default:
      return 'pendiente_realizacion';
  }
}

function labelTipoAudiencia(tipo: string): string {
  if (tipo === 'confesional') return 'confesional';
  if (tipo === 'testimonial') return 'testimonial';
  return TIPO_LABELS[tipo] ?? tipo;
}

export function buildCedulaAudienciaDiligencia(
  padre: ControlPruebaItem,
  opts: {
    destinatario?: string;
    autoCreated?: boolean;
    triggerKey?: string;
    orden: number;
    estadoDiligencia?: string;
    fechaLibramiento?: string | null;
    fechaDiligenciamiento?: string | null;
    observaciones?: string | null;
  },
): ControlPruebaItem {
  const ap = padre.audienciaPrueba ?? {};
  const fecha = ap.fechaAudiencia ?? padre.fechaLimite ?? '';
  const hora = ap.horaAudiencia ?? '';
  const destinatario = opts.destinatario?.trim() ?? '';
  const parentTipo = parentTipoDeItem(padre)!;
  const tk = opts.triggerKey ?? triggerKeyCedula(padre.id, destinatario, fecha, hora);
  const tipoLabel = labelTipoAudiencia(padre.tipo);
  const fechaLimite = fecha ? restarDiasHabiles(fecha, DIAS_ANTES_AUDIENCIA_CEDULA) : null;

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'cedula_audiencia',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Cédula audiencia ${tipoLabel}${destinatario ? ` — ${destinatario}` : ''}`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'cedula',
    descripcion: `Cédula de notificación de audiencia ${tipoLabel}${fecha ? ` — ${fecha}` : ''}${hora ? ` ${hora}` : ''}`.trim(),
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: opts.estadoDiligencia ?? 'pendiente_realizacion',
    fechaLimite,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: opts.observaciones ?? null,
    vinculo,
    diligencia: {
      destinatario: destinatario || undefined,
      objeto: padre.descripcion,
      medioNotificacion: 'papel',
      fechaPresentacion: null,
      fechaLibramiento: opts.fechaLibramiento ?? null,
      fechaDiligenciamiento: opts.fechaDiligenciamiento ?? null,
      pruebaVinculadaId: padre.id,
    },
  };
}

function existeHijoConTrigger(items: ControlPruebaItem[], triggerKey: string): boolean {
  return items.some((i) => i.vinculo?.triggerKey === triggerKey);
}

function cedulasActivasDePadre(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter(
    (i) => i.vinculo?.parentItemId === parentId && i.vinculo?.rol === 'cedula_audiencia',
  );
}

/** Quita cédulas auto-creadas al desfijar/postergar audiencia o eliminar el ítem padre. */
function eliminarHijosAutoCreados(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter((i) => !(i.vinculo?.parentItemId === parentId && i.vinculo.autoCreated));
}

/** Al eliminar padre: quitar cédulas auto-creadas vinculadas (las manuales se conservan). */
export function marcarHijosSinEfectoPorPadreEliminado(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  return eliminarHijosAutoCreados(items, parentId);
}

function actualizarPlazosCedulasActivas(items: ControlPruebaItem[], padre: ControlPruebaItem): ControlPruebaItem[] {
  const ap = padre.audienciaPrueba ?? {};
  const fecha = ap.fechaAudiencia;
  if (!fecha) return items;
  const fechaLimite = restarDiasHabiles(fecha, DIAS_ANTES_AUDIENCIA_CEDULA);
  const hora = ap.horaAudiencia ?? '';
  const tipoLabel = labelTipoAudiencia(padre.tipo);

  return items.map((i) => {
    if (i.vinculo?.parentItemId !== padre.id || i.vinculo.rol !== 'cedula_audiencia') return i;
    const dest = i.diligencia?.destinatario ?? '';
    return {
      ...i,
      fechaLimite,
      descripcion: `Cédula de notificación de audiencia ${tipoLabel} — ${fecha}${hora ? ` ${hora}` : ''}`,
      vinculo: {
        ...i.vinculo,
        triggerKey: triggerKeyCedula(padre.id, dest, fecha, hora),
        vinculoLabel: `Cédula audiencia ${tipoLabel}${dest ? ` — ${dest}` : ''}`,
      },
    };
  });
}

/** Migra cedulasNotificacion[] embebidas → ítems diligencia (una sola copia canónica). */
export function migrarCedulasEmbebidas(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let result = [...items];
  const nuevos: ControlPruebaItem[] = [];

  for (const padre of result) {
    const embebidas = padre.audienciaPrueba?.cedulasNotificacion ?? [];
    if (embebidas.length === 0) continue;

    for (const ced of embebidas) {
      const ap = padre.audienciaPrueba ?? {};
      const fecha = ap.fechaAudiencia ?? '';
      const hora = ap.horaAudiencia ?? '';
      const tk = triggerKeyCedula(padre.id, ced.destinatario, fecha, hora);
      if (existeHijoConTrigger([...result, ...nuevos], tk)) continue;

      nuevos.push(
        buildCedulaAudienciaDiligencia(padre, {
          destinatario: ced.destinatario,
          autoCreated: true,
          triggerKey: tk,
          orden: result.length + nuevos.length + 1,
          estadoDiligencia: mapEstadoCedulaLegacyAEmbedded(ced.estado),
          fechaLibramiento: ced.fechaLibramiento,
          fechaDiligenciamiento: ced.fechaDiligenciamiento,
          observaciones: ced.observaciones,
        }),
      );
    }

    result = result.map((i) => {
      if (i.id !== padre.id || !i.audienciaPrueba?.cedulasNotificacion) return i;
      const { cedulasNotificacion: _ced, ...apRest } = i.audienciaPrueba;
      return { ...i, audienciaPrueba: apRest };
    });
  }

  if (nuevos.length === 0) {
    return result;
  }

  return [...result, ...nuevos].map((item, index) => ({ ...item, orden: index + 1 }));
}

function cedulasIntimacionDocumentalDePadre(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter(
    (i) => i.vinculo?.parentItemId === parentId && i.vinculo?.rol === 'cedula_intimacion_documental',
  );
}

function triggerKeyIntimacionDocumental(parentId: string, parte: string, plazo: string, medio: string): string {
  return `cedula_intimacion_documental|${parentId}|${parte}|${plazo}|${medio}`;
}

export function buildCedulaIntimacionDocumental(
  padre: ControlPruebaItem,
  opts: {
    destinatario?: string;
    autoCreated?: boolean;
    triggerKey?: string;
    orden: number;
    estadoDiligencia?: string;
    fechaLibramiento?: string | null;
    fechaDiligenciamiento?: string | null;
    observaciones?: string | null;
  },
): ControlPruebaItem {
  const dep = padre.documentalEnPoder ?? {};
  const plazo = dep.plazoPresentacion ?? padre.fechaLimite ?? '';
  const parte = String(dep.parteConDocumentos ?? parteContrariaDefault(padre.ofrecidaPor));
  const medio = (dep.medioIntimacion as CedulaNotifMedio) ?? 'papel';
  const destinatario = opts.destinatario?.trim() || labelParteConDocumentos(parte);
  const tk = opts.triggerKey ?? triggerKeyIntimacionDocumental(padre.id, parte, plazo, medio);
  const tipoCedula = medio === 'electronica' ? 'cedula_electronica' : 'cedula';

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo: 'documental_en_poder',
    parentCategoria: resolveCategoria(padre),
    rol: 'cedula_intimacion_documental',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Cédula intimación documental — ${destinatario}`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: tipoCedula,
    descripcion: `Cédula intimación documental — ${destinatario}`,
    ofrecidaPor: 'tribunal',
    estado: opts.estadoDiligencia ?? 'pendiente_realizacion',
    fechaLimite: plazo || null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: opts.observaciones ?? null,
    vinculo,
    diligencia: {
      destinatario,
      objeto: dep.documentosDetalle ?? padre.descripcion,
      medioNotificacion: medio,
      fechaPresentacion: null,
      fechaLibramiento: opts.fechaLibramiento ?? null,
      fechaDiligenciamiento: opts.fechaDiligenciamiento ?? null,
      plazoContestacion: plazo || null,
      pruebaVinculadaId: padre.id,
    },
  };
}

function triggerKeyInformativaAutenticidad(parentId: string): string {
  return `informativa_autenticidad|${parentId}`;
}

function triggerKeyOficioInformativaAutenticidad(parentId: string, informativaId: string): string {
  return `oficio_informativa_autenticidad|${parentId}|${informativaId}`;
}

function hijosInformativaAutenticidad(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter(
    (i) => i.vinculo?.parentItemId === parentId && i.vinculo?.rol === 'informativa_autenticidad',
  );
}

function oficiosInformativaAutenticidad(items: ControlPruebaItem[], informativaId: string): ControlPruebaItem[] {
  return items.filter(
    (i) =>
      i.vinculo?.parentItemId === informativaId &&
      i.vinculo?.rol === 'oficio_informativa' &&
      resolveCategoria(i) === 'diligencia',
  );
}

export function buildInformativaAutenticidadDocumental(
  padre: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number },
): ControlPruebaItem {
  const dep = padre.documental ?? {};
  const parentTipo = parentTipoDeItem(padre) ?? 'documental';
  const tk = opts.triggerKey ?? triggerKeyInformativaAutenticidad(padre.id);
  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'informativa_autenticidad',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: 'Informativa — autenticidad documental',
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'prueba',
    tipo: 'informativa',
    descripcion: `Informativa sobre autenticidad — ${padre.descripcion.slice(0, 120)}`,
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: 'pendiente_produccion',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: 'Impugnación de autenticidad de documental acompañada.',
    vinculo,
  };
}

export function buildOficioInformativaAutenticidad(
  padre: ControlPruebaItem,
  informativa: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number },
): ControlPruebaItem {
  const dep = padre.documental ?? {};
  const destinatario = dep.destinatarioOficio?.trim() || 'Oficiado';
  const parentTipo = parentTipoDeItem(padre) ?? 'documental';
  const tk = opts.triggerKey ?? triggerKeyOficioInformativaAutenticidad(padre.id, informativa.id);

  const vinculo: SubprocesoVinculo = {
    parentItemId: informativa.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'oficio_informativa',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Oficio informativa autenticidad — ${destinatario}`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'oficio',
    descripcion: `Oficio informativa sobre autenticidad — ${padre.descripcion.slice(0, 100)}`,
    ofrecidaPor: 'tribunal',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    diligencia: {
      destinatario,
      objeto: `Informar sobre autenticidad de: ${padre.descripcion}`,
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      pruebaVinculadaId: padre.id,
    },
  };
}

function padreConIntimacionOrdenada(item: ControlPruebaItem): boolean {
  return item.estado === 'intimacion_ordenada';
}

function padreConAutenticidadImpugnada(item: ControlPruebaItem): boolean {
  return item.estado === 'autenticidad_impugnada';
}

function padreConAudienciaFijada(item: ControlPruebaItem): boolean {
  if (item.estado !== 'audiencia_fijada') return false;
  const ap = item.audienciaPrueba ?? {};
  return Boolean(ap.fechaAudiencia && ap.horaAudiencia);
}

function evaluarSubProcesosAudiencia(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre || !requiereAudienciaPrueba(padre.tipo)) {
    return { items, creados, alertas };
  }

  const anterior = ctx.itemAnterior;
  const nuevoEstado = padre.estado;
  const estadoAnterior = anterior.estado;

  // Suspensión / desfijación → sin efecto
  if (
    (nuevoEstado === 'postpuesta_juez' || nuevoEstado === 'pendiente_produccion') &&
    estadoAnterior === 'audiencia_fijada'
  ) {
    items = eliminarHijosAutoCreados(items, padre.id);
    alertas.push('Cédulas auto-creadas eliminadas (audiencia desfijada o postergada).');
    return { items, creados, alertas };
  }

  // Reprogramación fecha/hora
  const fechaCambio =
    padre.audienciaPrueba?.fechaAudiencia !== anterior.audienciaPrueba?.fechaAudiencia ||
    padre.audienciaPrueba?.horaAudiencia !== anterior.audienciaPrueba?.horaAudiencia;

  if (padreConAudienciaFijada(padre) && fechaCambio && cedulasActivasDePadre(items, padre.id).length > 0) {
    items = actualizarPlazosCedulasActivas(items, padre);
    alertas.push('Plazos de cédulas vinculadas actualizados.');
  }

  // Audiencia fijada → crear cédula(s) idempotente(s)
  if (padreConAudienciaFijada(padre)) {
    const ap = padre.audienciaPrueba!;
    const testigos = padre.tipo === 'testimonial' ? (padre.testigos ?? []) : [];

    if (testigos.length > 0) {
      // Una cédula por testigo — cada uno se notifica individualmente.
      const activas = cedulasActivasDePadre(items, padre.id);
      for (const testigo of testigos) {
        const tk = triggerKeyCedula(padre.id, testigo.nombre, ap.fechaAudiencia!, ap.horaAudiencia!);
        const yaTiene = activas.some((c) => c.diligencia?.destinatario === testigo.nombre);
        if (yaTiene || existeHijoConTrigger(items, tk)) continue;
        const nuevo = buildCedulaAudienciaDiligencia(padre, {
          destinatario: testigo.nombre,
          autoCreated: true,
          triggerKey: tk,
          orden: items.length + 1,
        });
        items = [...items, nuevo];
        creados.push(nuevo);
      }
      if (creados.length > 0) {
        alertas.push(
          `Se ${creados.length === 1 ? 'creó' : 'crearon'} ${creados.length} cédula(s) de notificación, una por testigo.`,
        );
      }
    } else {
      const tk = triggerKeyCedula(padre.id, '', ap.fechaAudiencia!, ap.horaAudiencia!);
      const activas = cedulasActivasDePadre(items, padre.id);

      if (activas.length === 0 && !existeHijoConTrigger(items, tk)) {
        const nuevo = buildCedulaAudienciaDiligencia(padre, {
          destinatario: '',
          autoCreated: true,
          triggerKey: tk,
          orden: items.length + 1,
        });
        items = [...items, nuevo];
        creados.push(nuevo);
        alertas.push('Se creó cédula de notificación en Comunicaciones.');
      }
    }
  }

  return { items, creados, alertas };
}

function evaluarSubProcesosDocumentalEnPoder(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre || !requiereFlujoDocumentalEnPoder(padre.tipo)) {
    return { items, creados, alertas };
  }

  const anterior = ctx.itemAnterior;
  const nuevoEstado = padre.estado;
  const estadoAnterior = anterior.estado;

  if (
    (nuevoEstado === 'postpuesta_juez' || nuevoEstado === 'pendiente_produccion') &&
    estadoAnterior === 'intimacion_ordenada'
  ) {
    items = eliminarHijosAutoCreados(items, padre.id);
    alertas.push('Cédula(s) de intimación eliminadas (intimación revertida o postergada).');
    return { items, creados, alertas };
  }

  if (padreConIntimacionOrdenada(padre)) {
    const dep = padre.documentalEnPoder ?? {};
    const parte = String(dep.parteConDocumentos ?? parteContrariaDefault(padre.ofrecidaPor));
    const plazo = dep.plazoPresentacion ?? padre.fechaLimite ?? '';
    const medio = String(dep.medioIntimacion ?? 'papel');
    const tk = triggerKeyIntimacionDocumental(padre.id, parte, plazo, medio);
    const activas = cedulasIntimacionDocumentalDePadre(items, padre.id);

    if (activas.length === 0 && !existeHijoConTrigger(items, tk)) {
      const cedula = buildCedulaIntimacionDocumental(padre, {
        autoCreated: true,
        triggerKey: tk,
        orden: items.length + 1,
      });
      items = [...items, cedula];
      creados.push(cedula);
      alertas.push('Se creó cédula de intimación documental en Comunicaciones.');
    }
  }

  return { items, creados, alertas };
}

function eliminarHijosAutenticidadAutoCreados(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  const informativaIds = new Set(
    items
      .filter((i) => i.vinculo?.parentItemId === parentId && i.vinculo.autoCreated)
      .map((i) => i.id),
  );
  return items.filter((i) => {
    if (i.vinculo?.parentItemId === parentId && i.vinculo.autoCreated) return false;
    if (i.vinculo?.autoCreated && informativaIds.has(i.vinculo.parentItemId)) return false;
    if (
      i.vinculo?.autoCreated &&
      i.vinculo.rol === 'oficio_informativa' &&
      i.diligencia?.pruebaVinculadaId === parentId
    ) {
      return false;
    }
    return true;
  });
}

function evaluarSubProcesosDocumentalAutenticidad(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre || !requiereFlujoAutenticidadDocumental(padre.tipo)) {
    return { items, creados, alertas };
  }

  const estadoAnterior = ctx.itemAnterior.estado;
  const nuevoEstado = padre.estado;

  if (
    (nuevoEstado === 'postpuesta_juez' || nuevoEstado === 'pendiente_produccion') &&
    estadoAnterior === 'autenticidad_impugnada'
  ) {
    items = eliminarHijosAutenticidadAutoCreados(items, padre.id);
    alertas.push('Informativa y oficio de autenticidad eliminados (impugnación revertida o postergada).');
    return { items, creados, alertas };
  }

  if (padreConAutenticidadImpugnada(padre)) {
    const tkInfo = triggerKeyInformativaAutenticidad(padre.id);
    let informativa = hijosInformativaAutenticidad(items, padre.id)[0];

    if (!informativa && !existeHijoConTrigger(items, tkInfo)) {
      informativa = buildInformativaAutenticidadDocumental(padre, {
        autoCreated: true,
        triggerKey: tkInfo,
        orden: items.length + 1,
      });
      items = [...items, informativa];
      creados.push(informativa);
    }

    if (informativa) {
      const tkOficio = triggerKeyOficioInformativaAutenticidad(padre.id, informativa.id);
      const tieneOficio =
        oficiosInformativaAutenticidad(items, informativa.id).length > 0 || existeHijoConTrigger(items, tkOficio);

      if (!tieneOficio) {
        const oficio = buildOficioInformativaAutenticidad(padre, informativa, {
          autoCreated: true,
          triggerKey: tkOficio,
          orden: items.length + 1,
        });
        items = [...items, oficio];
        creados.push(oficio);
      }
    }

    if (creados.length > 0) {
      alertas.push('Se crearon ítems de informativa y oficio para resolver autenticidad documental.');
    }
  }

  return { items, creados, alertas };
}

export function evaluarSubProcesosAutomaticos(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const audiencia = evaluarSubProcesosAudiencia(ctx);
  const documentalPoder = evaluarSubProcesosDocumentalEnPoder({ ...ctx, items: audiencia.items });
  const documentalAuth = evaluarSubProcesosDocumentalAutenticidad({
    ...ctx,
    items: documentalPoder.items,
  });
  return {
    items: documentalAuth.items,
    creados: [...audiencia.creados, ...documentalPoder.creados, ...documentalAuth.creados],
    alertas: [...audiencia.alertas, ...documentalPoder.alertas, ...documentalAuth.alertas],
  };
}

export function crearCedulaManualVinculada(
  items: ControlPruebaItem[],
  parentId: string,
  destinatario = '',
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre) return { items, creado: null };

  if (requiereFlujoDocumentalEnPoder(padre.tipo) && padre.estado === 'intimacion_ordenada') {
    const dep = padre.documentalEnPoder ?? {};
    const parte = String(dep.parteConDocumentos ?? parteContrariaDefault(padre.ofrecidaPor));
    const plazo = dep.plazoPresentacion ?? padre.fechaLimite ?? '';
    const medio = String(dep.medioIntimacion ?? 'papel');
    const tk = triggerKeyIntimacionDocumental(padre.id, parte, plazo, medio);
    if (existeHijoConTrigger(items, tk)) return { items, creado: null };
    const creado = buildCedulaIntimacionDocumental(padre, {
      destinatario,
      autoCreated: false,
      triggerKey: tk,
      orden: items.length + 1,
    });
    return { items: [...items, creado], creado };
  }

  if (!requiereAudienciaPrueba(padre.tipo) || padre.estado !== 'audiencia_fijada') {
    return { items, creado: null };
  }
  const ap = padre.audienciaPrueba ?? {};
  if (!ap.fechaAudiencia || !ap.horaAudiencia) return { items, creado: null };

  const tk = triggerKeyCedula(padre.id, destinatario, ap.fechaAudiencia, ap.horaAudiencia);
  if (existeHijoConTrigger(items, tk)) return { items, creado: null };

  const creado = buildCedulaAudienciaDiligencia(padre, {
    destinatario,
    autoCreated: false,
    triggerKey: tk,
    orden: items.length + 1,
  });
  return { items: [...items, creado], creado };
}

/** Reintento de notificación cuando la cédula de un testigo volvió rebotada/negativa. */
export function crearCedulaReintentoVinculada(
  items: ControlPruebaItem[],
  parentId: string,
  destinatario: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !requiereAudienciaPrueba(padre.tipo) || padre.estado !== 'audiencia_fijada') {
    return { items, creado: null };
  }
  const ap = padre.audienciaPrueba ?? {};
  if (!ap.fechaAudiencia || !ap.horaAudiencia) return { items, creado: null };

  const intentosPrevios = items.filter(
    (i) =>
      i.vinculo?.parentItemId === parentId &&
      i.vinculo?.rol === 'cedula_audiencia' &&
      i.diligencia?.destinatario === destinatario,
  ).length;
  const tk = `${triggerKeyCedula(padre.id, destinatario, ap.fechaAudiencia, ap.horaAudiencia)}#reintento${intentosPrevios}`;

  const creado = buildCedulaAudienciaDiligencia(padre, {
    destinatario,
    autoCreated: false,
    triggerKey: tk,
    orden: items.length + 1,
    observaciones: 'Reintento de notificación tras cédula rebotada / resultado negativo.',
  });
  return { items: [...items, creado], creado };
}

function triggerKeyMandamientoConduccion(parentId: string, testigo: string, intento: number): string {
  return `mandamiento_conduccion|${parentId}|${testigo}|${intento}`;
}

/** El testigo, ya notificado, no compareció a la audiencia → mandamiento de conducción por fuerza pública. */
export function crearMandamientoConduccionTestigo(
  items: ControlPruebaItem[],
  parentId: string,
  testigoNombre: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !requiereAudienciaPrueba(padre.tipo)) return { items, creado: null };

  const intentosPrevios = items.filter(
    (i) =>
      i.vinculo?.parentItemId === parentId &&
      i.vinculo?.rol === 'mandamiento_conduccion' &&
      i.diligencia?.destinatario === testigoNombre,
  ).length;
  const tk = triggerKeyMandamientoConduccion(parentId, testigoNombre, intentosPrevios);

  const ap = padre.audienciaPrueba ?? {};
  const fechaTexto = ap.fechaAudiencia ? ` del ${ap.fechaAudiencia}` : '';
  const parentTipo = parentTipoDeItem(padre) ?? 'testimonial';

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'mandamiento_conduccion',
    autoCreated: false,
    vinculoLabel: `Mandamiento de conducción — ${testigoNombre}`,
    triggerKey: tk,
  };

  const creado: ControlPruebaItem = {
    id: crypto.randomUUID(),
    orden: items.length + 1,
    categoria: 'diligencia',
    tipo: 'mandamiento',
    descripcion: `Mandamiento de conducción — el testigo ${testigoNombre} no compareció a la audiencia testimonial${fechaTexto}.`,
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: 'Comparecencia compulsiva por fuerza pública (art. 437 CPCC) por incomparecencia injustificada.',
    vinculo,
    diligencia: {
      destinatario: testigoNombre,
      objeto: `Conducción por la fuerza pública del testigo ${testigoNombre} a audiencia testimonial.`,
      pruebaVinculadaId: padre.id,
    },
  };

  return { items: [...items, creado], creado };
}

export function contarSubprocesosActivos(parentId: string, items: ControlPruebaItem[]): number {
  const padre = items.find((i) => i.id === parentId);
  const directos = hijosDePadre(parentId, items);
  if (padre?.tipo === 'documental') {
    const oficios = items.filter(
      (i) =>
        i.vinculo?.rol === 'oficio_informativa' &&
        i.diligencia?.pruebaVinculadaId === parentId,
    );
    return directos.length + oficios.length;
  }
  return directos.length;
}
