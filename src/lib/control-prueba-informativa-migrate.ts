import type { ControlPruebaItem } from '@/types/control-prueba';
import { resolveCategoria } from '@/lib/control-prueba';

const ESTADO_PRUEBA_A_DILIGENCIA: Record<string, string> = {
  pendiente_produccion: 'pendiente',
  postpuesta_juez: 'pendiente',
  autenticidad_impugnada: 'pendiente',
  intimacion_ordenada: 'pendiente',
  audiencia_fijada: 'pendiente',
  producida: 'cumplido',
  desistida: 'vencido',
  no_admitida: 'vencido',
};

function esPuenteInformativaAutenticidad(item: ControlPruebaItem): boolean {
  return (
    item.vinculo?.rol === 'informativa_autenticidad' ||
    (item.categoria === 'prueba' &&
      item.tipo === 'informativa' &&
      Boolean(item.vinculo?.parentItemId))
  );
}

function esOficioAutenticidadVinculado(item: ControlPruebaItem): boolean {
  return (
    resolveCategoria(item) === 'diligencia' &&
    (item.tipo === 'oficio' || item.tipo === 'oficio_electronico') &&
    (item.vinculo?.rol === 'oficio_informativa' || item.vinculo?.rol === 'oficio_autenticidad')
  );
}

/** Convierte prueba informativa admitida → diligencia oficio con flujo estándar. */
export function migratePruebaInformativaToOficio(item: ControlPruebaItem): ControlPruebaItem {
  if (item.categoria !== 'prueba' || item.tipo !== 'informativa' || esPuenteInformativaAutenticidad(item)) {
    return item;
  }

  const estado = ESTADO_PRUEBA_A_DILIGENCIA[String(item.estado)] ?? 'pendiente';
  const baseDiligencia = item.diligencia ?? {
    objeto: item.descripcion,
    fechaPresentacion: null,
    fechaLibramiento: null,
    fechaDiligenciamiento: null,
    plazoContestacion: item.fechaLimite ?? null,
  };

  const { vinculo, ...resto } = item;
  const conservarVinculo = vinculo?.rol === 'oficio_informativa' || vinculo?.rol === 'oficio_autenticidad';

  return {
    ...resto,
    categoria: 'diligencia',
    tipo: 'oficio',
    estado,
    ofrecidaPor: item.ofrecidaPor ?? 'actor',
    diligencia: {
      ...baseDiligencia,
      objeto: baseDiligencia.objeto ?? item.descripcion,
      plazoContestacion: baseDiligencia.plazoContestacion ?? item.fechaLimite ?? null,
    },
    ...(conservarVinculo ? { vinculo } : {}),
  };
}

function documentalPadreDeInformativa(
  informativa: ControlPruebaItem,
  items: ControlPruebaItem[],
): string | null {
  if (informativa.vinculo?.parentItemId) {
    const padre = items.find((i) => i.id === informativa.vinculo!.parentItemId);
    if (padre?.tipo === 'documental') return padre.id;
  }
  const oficioHijo = items.find(
    (i) =>
      i.vinculo?.parentItemId === informativa.id &&
      i.vinculo?.rol === 'oficio_informativa' &&
      i.diligencia?.pruebaVinculadaId,
  );
  return oficioHijo?.diligencia?.pruebaVinculadaId ?? null;
}

function reparentOficioAutenticidad(
  item: ControlPruebaItem,
  items: ControlPruebaItem[],
  informativaIds: Set<string>,
): ControlPruebaItem {
  if (!esOficioAutenticidadVinculado(item)) return item;

  const parentId = item.vinculo?.parentItemId;
  if (!parentId || !informativaIds.has(parentId)) {
    if (item.vinculo?.rol === 'oficio_informativa' && item.diligencia?.pruebaVinculadaId) {
      const docId = item.diligencia.pruebaVinculadaId;
      return {
        ...item,
        vinculo: {
          ...item.vinculo,
          parentItemId: docId,
          parentTipo: 'documental',
          parentCategoria: 'prueba',
          rol: 'oficio_autenticidad',
          vinculoLabel: item.vinculo.vinculoLabel.replace(/informativa/gi, 'autenticidad'),
        },
      };
    }
    return item;
  }

  const informativa = items.find((i) => i.id === parentId);
  const documentalId = informativa ? documentalPadreDeInformativa(informativa, items) : null;
  if (!documentalId) return item;

  return {
    ...item,
    descripcion: item.descripcion.replace(/^Oficio informativa/i, 'Oficio autenticidad'),
    vinculo: {
      ...item.vinculo!,
      parentItemId: documentalId,
      parentTipo: 'documental',
      parentCategoria: 'prueba',
      rol: 'oficio_autenticidad',
      vinculoLabel: item.vinculo!.vinculoLabel.replace(/informativa/gi, 'autenticidad'),
    },
    diligencia: {
      ...item.diligencia,
      pruebaVinculadaId: documentalId,
    },
  };
}

/**
 * Elimina ítems puente informativa y convierte prueba informativa → oficio.
 * Idempotente: puede ejecutarse en cada normalizeItems.
 */
export function migrateExpedienteInformativaAOficio(items: ControlPruebaItem[]): ControlPruebaItem[] {
  const informativaIds = new Set(
    items.filter((i) => i.categoria === 'prueba' && i.tipo === 'informativa').map((i) => i.id),
  );

  const sinPuentes = items.filter((i) => !esPuenteInformativaAutenticidad(i));

  const reparented = sinPuentes.map((item) => reparentOficioAutenticidad(item, items, informativaIds));

  return reparented
    .map((item) => migratePruebaInformativaToOficio(item))
    .filter((item) => !(item.categoria === 'prueba' && item.tipo === 'informativa'));
}
