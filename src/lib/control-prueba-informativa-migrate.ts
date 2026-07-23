import type { ControlPruebaItem } from '@/types/control-prueba';
import { INFORMATIVA_ESTADOS } from '@/types/control-prueba';
import { resolveCategoria } from '@/lib/control-prueba';

const ESTADO_DILIGENCIA_A_INFORMATIVA: Record<string, string> = {
  pendiente: 'pendiente',
  pendiente_realizacion: 'pendiente',
  librado: 'librado',
  librada: 'librado',
  librada_notificada: 'producida',
  diligenciado: 'diligenciado',
  enviado: 'presentado',
  presentada: 'presentado',
  observado: 'observado',
  contestado: 'producida',
  observada: 'observado',
  contestacion_parcial: 'contestacion_parcial',
  cumplido: 'producida',
  vencido: 'vencido',
  notificada: 'producida',
  resultado_negativo: 'vencido',
  valoracion_judicial: 'valoracion_judicial',
  // Legacy prueba
  pendiente_produccion: 'pendiente',
  postpuesta_juez: 'pendiente',
  producida: 'producida',
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

/** Oficio suelto (sin padre) ofrecido por una parte → era informativa originaria migrada. */
export function esOficioSueltoInformativa(item: ControlPruebaItem): boolean {
  if (resolveCategoria(item) !== 'diligencia') return false;
  if (item.tipo !== 'oficio' && item.tipo !== 'oficio_electronico') return false;
  if (item.vinculo?.parentItemId) return false;
  if (item.vinculo?.rol === 'oficio_autenticidad' || item.vinculo?.rol === 'oficio_informativa') {
    return false;
  }
  // Aclaración / reiteración de otro oficio: queda en Comunicaciones
  if (item.diligencia?.oficioOrigenId) return false;
  const parte = item.ofrecidaPor ?? 'tribunal';
  return parte === 'actor' || parte === 'demandado' || parte === 'tercero';
}

function coerceEstadoInformativa(estado: string): string {
  const mapped = ESTADO_DILIGENCIA_A_INFORMATIVA[estado] ?? estado;
  if ((INFORMATIVA_ESTADOS as readonly string[]).includes(mapped)) return mapped;
  return 'pendiente';
}

/** Convierte oficio suelto (informativa migrada) → prueba informativa con tracking de oficio. */
export function migrateOficioSueltoAInformativa(item: ControlPruebaItem): ControlPruebaItem {
  if (!esOficioSueltoInformativa(item)) return item;

  const { vinculo: _v, ...resto } = item;
  return {
    ...resto,
    categoria: 'prueba',
    tipo: 'informativa',
    estado: coerceEstadoInformativa(String(item.estado)),
    ofrecidaPor: item.ofrecidaPor ?? 'actor',
    diligencia: {
      ...(item.diligencia ?? {}),
      objeto: item.diligencia?.objeto ?? item.descripcion,
      plazoContestacion: item.diligencia?.plazoContestacion ?? item.fechaLimite ?? null,
    },
  };
}

/** Asegura que una prueba informativa tenga estados del ciclo oficio. */
export function normalizePruebaInformativa(item: ControlPruebaItem): ControlPruebaItem {
  if (item.categoria !== 'prueba' || item.tipo !== 'informativa') return item;
  if (item.vinculo?.parentItemId) return item; // puente legacy (se filtra aparte)

  return {
    ...item,
    estado: coerceEstadoInformativa(String(item.estado)),
    diligencia: {
      ...(item.diligencia ?? {}),
      objeto: item.diligencia?.objeto ?? item.descripcion,
      plazoContestacion: item.diligencia?.plazoContestacion ?? item.fechaLimite ?? null,
    },
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
 * - Elimina puentes legacy informativa_autenticidad.
 * - Reparenta oficios de autenticidad al documental.
 * - Sube oficios sueltos (informativa migrada) a prueba informativa.
 * - Conserva prueba informativa originaria (no la baja a Comunicaciones).
 */
export function migrateExpedienteInformativaAOficio(items: ControlPruebaItem[]): ControlPruebaItem[] {
  const informativaIds = new Set(
    items.filter((i) => i.categoria === 'prueba' && i.tipo === 'informativa').map((i) => i.id),
  );

  const sinPuentes = items.filter((i) => !esPuenteInformativaAutenticidad(i));

  const reparented = sinPuentes.map((item) => reparentOficioAutenticidad(item, items, informativaIds));

  return reparented
    .map((item) => migrateOficioSueltoAInformativa(item))
    .map((item) => normalizePruebaInformativa(item));
}
