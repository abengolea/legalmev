import type { ControlPruebaItem } from '@/types/control-prueba';

export function esOficio(item: Pick<ControlPruebaItem, 'categoria' | 'tipo'>): boolean {
  return item.categoria === 'diligencia' && (item.tipo === 'oficio' || item.tipo === 'oficio_electronico');
}

function estadoInicialOficio(tipo: string): string {
  return tipo === 'oficio_electronico' ? 'pendiente_realizacion' : 'pendiente';
}

/** Crea oficio de aclaración vinculado al oficio con contestación parcial. */
export function crearOficioAclaracion(
  items: ControlPruebaItem[],
  parentId: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !esOficio(padre)) return { items, creado: null };
  if (String(padre.estado) !== 'contestacion_parcial') return { items, creado: null };
  if (padre.diligencia?.oficioSucesorId) return { items, creado: null };

  const tipo = padre.tipo === 'oficio_electronico' ? 'oficio_electronico' : 'oficio';
  const objetoBase = padre.diligencia?.objeto?.trim() || padre.descripcion.trim();
  const creado: ControlPruebaItem = {
    id: crypto.randomUUID(),
    orden: items.length + 1,
    categoria: 'diligencia',
    tipo,
    descripcion: objetoBase
      ? `Oficio aclaratorio — ${objetoBase}`.slice(0, 240)
      : 'Oficio aclaratorio (contestación parcial)',
    ofrecidaPor: padre.ofrecidaPor ?? 'tribunal',
    estado: estadoInicialOficio(tipo),
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: 'Pedido por contestación parcial del oficio anterior — reiteración / aclaraciones.',
    diligencia: {
      destinatario: padre.diligencia?.destinatario,
      objeto: objetoBase ? `${objetoBase} (aclaraciones)` : undefined,
      oficioOrigenId: padre.id,
      pruebaVinculadaId: padre.diligencia?.pruebaVinculadaId ?? null,
    },
  };

  const itemsActualizados = items.map((i) =>
    i.id === parentId
      ? { ...i, diligencia: { ...i.diligencia, oficioSucesorId: creado.id } }
      : i,
  );

  return { items: [...itemsActualizados, creado], creado };
}

/** Crea oficio de reiteración cuando el oficio anterior quedó sin respuesta (vencido). */
export function crearOficioReiteracion(
  items: ControlPruebaItem[],
  parentId: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !esOficio(padre)) return { items, creado: null };
  if (String(padre.estado) !== 'vencido') return { items, creado: null };
  if (padre.diligencia?.oficioSucesorId) return { items, creado: null };

  const tipo = padre.tipo === 'oficio_electronico' ? 'oficio_electronico' : 'oficio';
  const objetoBase = padre.diligencia?.objeto?.trim() || padre.descripcion.trim();
  const creado: ControlPruebaItem = {
    id: crypto.randomUUID(),
    orden: items.length + 1,
    categoria: 'diligencia',
    tipo,
    descripcion: objetoBase
      ? `Oficio de reiteración — ${objetoBase}`.slice(0, 240)
      : 'Oficio de reiteración (sin respuesta en plazo)',
    ofrecidaPor: padre.ofrecidaPor ?? 'tribunal',
    estado: estadoInicialOficio(tipo),
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: 'Pedido por falta de respuesta del oficio anterior dentro del plazo — reiteración / conminatoria.',
    diligencia: {
      destinatario: padre.diligencia?.destinatario,
      objeto: objetoBase ? `${objetoBase} (reiteración)` : undefined,
      oficioOrigenId: padre.id,
      pruebaVinculadaId: padre.diligencia?.pruebaVinculadaId ?? null,
    },
  };

  const itemsActualizados = items.map((i) =>
    i.id === parentId
      ? { ...i, diligencia: { ...i.diligencia, oficioSucesorId: creado.id } }
      : i,
  );

  return { items: [...itemsActualizados, creado], creado };
}

export function oficioRelacionadoLabel(item: ControlPruebaItem, otro: ControlPruebaItem): string {
  return `#${otro.orden} ${otro.descripcion.slice(0, 50) || otro.tipo}`;
}

/** Al marcar contestación parcial → oficio aclaratorio idempotente. */
export function evaluarOficioAclaracionAutomatico(
  items: ControlPruebaItem[],
  itemId: string,
  itemAnterior: ControlPruebaItem,
  patch: Partial<ControlPruebaItem>,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  if (patch.estado !== 'contestacion_parcial') return { items, creado: null };
  if (itemAnterior.estado === 'contestacion_parcial') return { items, creado: null };
  const padre = items.find((i) => i.id === itemId);
  if (!padre || !esOficio(padre)) return { items, creado: null };
  return crearOficioAclaracion(items, itemId);
}

/** Al marcar vencido (sin respuesta) → oficio de reiteración idempotente. */
export function evaluarOficioReiteracionAutomatico(
  items: ControlPruebaItem[],
  itemId: string,
  itemAnterior: ControlPruebaItem,
  patch: Partial<ControlPruebaItem>,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  if (patch.estado !== 'vencido') return { items, creado: null };
  if (itemAnterior.estado === 'vencido') return { items, creado: null };
  const padre = items.find((i) => i.id === itemId);
  if (!padre || !esOficio(padre)) return { items, creado: null };
  return crearOficioReiteracion(items, itemId);
}
