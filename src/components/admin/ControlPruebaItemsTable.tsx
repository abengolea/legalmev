'use client';

import { Fragment, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaExpediente, ControlPruebaItem, ItemCategoria, PruebaParte, TipoTramitePericial } from '@/types/control-prueba';
import {
  esAudienciaOfrecida,
  esPruebaOfrecida,
  estadosParaItem,
  getEstadoConfig,
  PARTE_LABELS,
  resolveCategoria,
  TIPO_LABELS,
  TIPOS_POR_CATEGORIA,
} from '@/lib/control-prueba';
import { ALERTA_NIVEL_CONFIG, evaluarAlertaItem } from '@/lib/control-prueba-alertas';
import { diasHabilesHasta, etiquetaDiasHabiles, plazoSugeridoDiasHabiles } from '@/lib/control-prueba-plazos';
import { progresoSubtareas } from '@/lib/control-prueba-subtareas';
import { contarSubprocesosActivos } from '@/lib/control-prueba-subprocesos';
import { patchTipoComunicacion } from '@/lib/control-prueba-cedula-notif';
import {
  esTipoPruebaSelectValue,
  opcionesTipoDiligencia,
  patchReclasificarAPrueba,
  type ParteGrupoTabla,
} from '@/lib/control-prueba-reclasificar';
import {
  resolucionBadgeClass,
  resolucionEtiqueta,
  resolucionFilaClass,
} from '@/lib/control-prueba-resolucion';
import {
  DESCRIPCION_PERICIAL_LABEL,
  DESCRIPCION_PERICIAL_PLACEHOLDER,
  labelTipoPrueba,
  opcionesTipoPrueba,
  parseTipoPruebaSelectValue,
  tipoPruebaSelectValue,
} from '@/lib/control-prueba-pericial';
import {
  estadosPruebaParaItem,
  patchTipoAudiencia,
  coerceEstadoAudienciaItem,
} from '@/lib/control-prueba-audiencia-prueba';
import { patchEstadoPruebaOfrecida } from '@/lib/control-prueba-cierre';
import { defaultEstadoForItem } from '@/lib/control-prueba';
import {
  patchDocumentalEnPoder,
  usaFlujoDocumentalEnPoder,
  intimacionDocumentalActiva,
} from '@/lib/control-prueba-documental-poder';
import {
  usaFlujoAutenticidadDocumental,
} from '@/lib/control-prueba-documental-autenticidad';
import { ControlPruebaOficiosAutenticidadEnlaces } from '@/components/admin/ControlPruebaDocumentalAutenticidadBlock';
import { ControlPruebaCedulasIntimacionDocumentalEnlaces } from '@/components/admin/ControlPruebaDocumentalEnPoderBlock';
import { ControlPruebaCedulasAudienciaEnlaces } from '@/components/admin/ControlPruebaCedulasAudienciaEnlaces';
import { ControlPruebaAudienciaEventoEnlaces } from '@/components/admin/ControlPruebaAudienciaEventoEnlaces';
import {
  esEventoAudienciaPrueba,
  patchEventoAudienciaMeta,
  patchFechaEventoAudiencia,
} from '@/lib/control-prueba-audiencia-evento';
import { ControlPruebaAutoTextarea } from '@/components/admin/ControlPruebaAutoTextarea';
import { ControlPruebaDateField } from '@/components/admin/ControlPruebaDateField';
import { ControlPruebaDeferredInput } from '@/components/admin/ControlPruebaDeferredInput';
import { ControlPruebaItemDetail } from '@/components/admin/ControlPruebaItemDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';

export type ControlItemsTableProps = {
  items: ControlPruebaItem[];
  categoria: ItemCategoria;
  expediente?: Partial<ControlPruebaExpediente>;
  pruebaItems?: ControlPruebaItem[];
  expedienteUrl?: string;
  highlightItemId?: string | null;
  compact?: boolean;
  onUpdate: (id: string, patch: Partial<ControlPruebaItem>) => void;
  onRemove: (id: string) => void;
  onAddCedulaVinculada?: (parentId: string, destinatario?: string) => void;
  onAddOficioAutenticidad?: (parentId: string, destinatario?: string) => void;
  onReintentarCedulaTestigo?: (parentId: string, destinatario: string) => void;
  onCrearMandamientoTestigo?: (parentId: string, testigoNombre: string) => void;
  onCrearOficioAclaracion?: (parentId: string) => void;
  onCrearOficioReiteracion?: (parentId: string) => void;
  onAddMovimientoPericial?: (parentId: string, rol: TipoTramitePericial) => void;
  onUpdateMovimientoPericial?: (movimientoId: string, patch: Partial<ControlPruebaItem>) => void;
  onRemoveMovimientoPericial?: (movimientoId: string) => void;
  onFocusItem?: (itemId: string) => void;
  onNuevaAudienciaVinculada?: (pruebaId: string) => void;
  /** Lista de terceros del expediente — para asignar ítems sin identificar. */
  tercerosNombres?: string[];
  showSelectorTercero?: boolean;
  /** Pestaña/grupo donde se muestra la tabla (para reclasificar comunicación → prueba). */
  parteGrupo?: ParteGrupoTabla;
};

const FECHA_PRIMARIA: Record<ItemCategoria, string> = {
  prueba: 'Límite',
  diligencia: 'Plazo',
  audiencia: 'Fecha',
  tramite: 'Plazo',
  mejor_proveer: 'Plazo',
};

function labelFechaPrimaria(categoria: ItemCategoria, items: ControlPruebaItem[]): string {
  if (categoria === 'audiencia' && items.some(esAudienciaOfrecida)) return 'Audiencia';
  if (categoria === 'prueba' && items.some((i) => i.tipo === 'documental_en_poder')) {
    return items.some((i) => i.estado === 'intimacion_ordenada') ? 'Plazo exhibición' : 'Límite';
  }
  return FECHA_PRIMARIA[categoria];
}

const PARTES_MEJOR_PROVEER = ['actor', 'demandado', 'tercero'] as const;

function usaColumnaObservaciones(categoria: ItemCategoria): boolean {
  return categoria === 'prueba' || categoria === 'diligencia' || categoria === 'audiencia';
}

/** Prueba ofrecida ancestro de una diligencia/evento (sube 1–2 niveles). */
function pruebaOfrecidaDeHijo(
  item: ControlPruebaItem,
  allItems: ControlPruebaItem[],
): ControlPruebaItem | null {
  let currentId: string | null =
    item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
  for (let i = 0; i < 3 && currentId; i++) {
    const padre = allItems.find((x) => x.id === currentId);
    if (!padre) return null;
    if (esPruebaOfrecida(padre)) return padre;
    currentId = padre.vinculo?.parentItemId ?? padre.diligencia?.pruebaVinculadaId ?? null;
  }
  return null;
}

function etiquetaPruebaVinculada(padre: ControlPruebaItem): string {
  const tipo = TIPO_LABELS[padre.tipo] ?? padre.tipo;
  return `Prueba #${padre.orden} · ${tipo}`;
}

function placeholderObservaciones(categoria: ItemCategoria, compact: boolean): string {
  if (categoria === 'diligencia') {
    return compact
      ? 'Notas, seguimiento, observaciones...'
      : 'Texto libre: notas del estudio, seguimiento, observaciones sobre esta diligencia...';
  }
  if (categoria === 'audiencia') {
    return compact
      ? 'Notas, seguimiento, observaciones...'
      : 'Texto libre: notas del estudio, seguimiento, observaciones sobre esta audiencia...';
  }
  return compact
    ? 'Notas, seguimiento, observaciones...'
    : 'Texto libre: notas del estudio, seguimiento, observaciones sobre esta prueba...';
}

function tableColSpan(categoria: ItemCategoria): number {
  // expand + # + tipo + desc + (observaciones|obligada) + estado + fecha + link + acciones
  return usaColumnaObservaciones(categoria) || categoria === 'mejor_proveer' ? 9 : 8;
}

function usaFlujoAudienciaParte(item: ControlPruebaItem): boolean {
  return esAudienciaOfrecida(item) || item.tipo === 'audiencia_testimonial';
}

/** Misma grilla en prueba, diligencia y audiencia para alinear columnas entre secciones. */
const COL = {
  expand: 'w-8 p-2',
  orden: 'w-9 p-2',
  tipo: 'w-[10rem] p-2 align-top',
  descripcion: 'p-2 align-top',
  observaciones: 'p-2 align-top',
  obligada: 'w-[6.5rem] p-2',
  estado: 'w-[9rem] p-2 align-top',
  fecha: 'w-[10rem] p-2 align-top',
  link: 'w-[11rem] p-2 align-top',
  acciones: 'w-[4.5rem] p-1 align-top',
} as const;

function ItemsTableColGroup({ categoria }: { categoria: ItemCategoria }) {
  const col5Width = categoria === 'mejor_proveer' ? '6.5rem' : '26%';
  return (
    <colgroup>
      <col style={{ width: '2rem' }} />
      <col style={{ width: '2.25rem' }} />
      <col style={{ width: '10rem' }} />
      <col style={{ width: '20%' }} />
      <col style={{ width: col5Width }} />
      <col style={{ width: '9rem' }} />
      <col style={{ width: '10rem' }} />
      <col style={{ width: '11rem' }} />
      <col style={{ width: '4.5rem' }} />
    </colgroup>
  );
}

export function ControlPruebaItemsTable({
  items,
  categoria,
  expediente = {},
  pruebaItems = [],
  expedienteUrl,
  highlightItemId,
  compact = false,
  onUpdate,
  onRemove,
  onAddCedulaVinculada,
  onAddOficioAutenticidad,
  onReintentarCedulaTestigo,
  onCrearMandamientoTestigo,
  onCrearOficioAclaracion,
  onCrearOficioReiteracion,
  onAddMovimientoPericial,
  onUpdateMovimientoPericial,
  onRemoveMovimientoPericial,
  onFocusItem,
  onNuevaAudienciaVinculada,
  tercerosNombres = [],
  showSelectorTercero = false,
  parteGrupo,
}: ControlItemsTableProps) {
  const allItems = expediente.items ?? items;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tipos = TIPOS_POR_CATEGORIA[categoria];
  const opcionesTipo = categoria === 'prueba' ? opcionesTipoPrueba(tipos) : tipos.map((t) => ({ value: t, label: TIPO_LABELS[t] ?? t }));
  const opcionesDiligencia = categoria === 'diligencia' ? opcionesTipoDiligencia(tipos) : [];
  const opcionesPruebaDiligencia = opcionesDiligencia.filter((o) => o.grupo === 'prueba');
  const opcionesComunicacion = opcionesDiligencia.filter((o) => o.grupo === 'actual');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Sin ítems en esta sección.
      </p>
    );
  }

  return (
    <>
    <Table className="table-fixed w-full min-w-[1024px]">
      <ItemsTableColGroup categoria={categoria} />
      <TableHeader>
        <TableRow className={compact ? 'h-8' : undefined}>
          <TableHead className={COL.expand} />
          <TableHead className={COL.orden}>#</TableHead>
          <TableHead className={COL.tipo}>Tipo</TableHead>
          <TableHead className={COL.descripcion}>Descripción</TableHead>
          {usaColumnaObservaciones(categoria) && (
            <TableHead className={COL.observaciones}>Observaciones</TableHead>
          )}
          {categoria === 'mejor_proveer' && <TableHead className={COL.obligada}>Obligada</TableHead>}
          <TableHead className={COL.estado}>Estado</TableHead>
          <TableHead className={COL.fecha}>{labelFechaPrimaria(categoria, items)}</TableHead>
          <TableHead className={COL.link}>Link</TableHead>
          <TableHead className={COL.acciones} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const cat = resolveCategoria(item);
          const estadoCfg = getEstadoConfig(cat, String(item.estado), item);
          const alerta = evaluarAlertaItem(item);
          const expanded = expandedIds.has(item.id);
          const prog = progresoSubtareas(item);
          const estadosItem = estadosPruebaParaItem(item, [...estadosParaItem(item)]);
          const etiquetaResolucion = resolucionEtiqueta(item, allItems);
          const badgeResolucion = resolucionBadgeClass(item);

          return (
            <Fragment key={item.id}>
              <TableRow
                id={`control-item-${item.id}`}
                className={cn(
                  'border-l-4 scroll-mt-24',
                  estadoCfg.rowClass,
                  resolucionFilaClass(item),
                  highlightItemId === item.id && 'ring-2 ring-primary ring-offset-2 bg-primary/5',
                  compact && 'text-xs',
                )}
              >
                <TableCell className={COL.expand}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleExpand(item.id)}
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
                <TableCell className={cn(COL.orden, 'text-muted-foreground text-xs')}>{item.orden}</TableCell>
                <TableCell className={COL.tipo}>
                  {categoria === 'prueba' ? (
                    <Select
                      value={tipoPruebaSelectValue(item)}
                      onValueChange={(v) => {
                        const parsed = parseTipoPruebaSelectValue(v, item.pericial);
                        const patch: Partial<ControlPruebaItem> = { ...parsed, categoria };
                        if (parsed.tipo === 'informativa') {
                          if (
                            !(
                              [
                                'pendiente',
                                'presentado',
                                'enviado',
                                'observado',
                                'librado',
                                'diligenciado',
                                'contestacion_parcial',
                                'producida',
                                'cumplido',
                                'vencido',
                                'valoracion_judicial',
                              ] as string[]
                            ).includes(String(item.estado))
                          ) {
                            patch.estado = defaultEstadoForItem('prueba', 'informativa');
                          }
                          patch.diligencia = {
                            ...(item.diligencia ?? {}),
                            objeto: item.diligencia?.objeto ?? item.descripcion,
                            plazoContestacion:
                              item.diligencia?.plazoContestacion ?? item.fechaLimite ?? null,
                          };
                        } else if (item.tipo === 'informativa') {
                          patch.estado = defaultEstadoForItem('prueba', parsed.tipo);
                          patch.diligencia = undefined;
                        }
                        onUpdate(item.id, patch);
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'text-xs h-auto py-1 [&>span]:line-clamp-2 [&>span]:whitespace-normal [&>span]:text-left',
                          compact ? 'min-h-7' : 'min-h-8',
                        )}
                      >
                        <SelectValue>{labelTipoPrueba(item)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesTipo.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : categoria === 'audiencia' ? (
                    <Select
                      value={item.tipo}
                      onValueChange={(v) => onUpdate(item.id, patchTipoAudiencia(item, v))}
                    >
                      <SelectTrigger
                        className={cn(
                          'text-xs h-auto py-1 [&>span]:line-clamp-2 [&>span]:whitespace-normal [&>span]:text-left',
                          compact ? 'min-h-7' : 'min-h-8',
                        )}
                      >
                        <SelectValue>{TIPO_LABELS[item.tipo] ?? item.tipo}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TIPO_LABELS[t] ?? t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={item.tipo}
                      onValueChange={(v) =>
                        onUpdate(
                          item.id,
                          esTipoPruebaSelectValue(v)
                            ? patchReclasificarAPrueba(item, v, { parteDestino: parteGrupo })
                            : patchTipoComunicacion(item, v),
                        )
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          'text-xs h-auto py-1 [&>span]:line-clamp-2 [&>span]:whitespace-normal [&>span]:text-left',
                          compact ? 'min-h-7' : 'min-h-8',
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Comunicación</SelectLabel>
                          {opcionesComunicacion.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        {opcionesPruebaDiligencia.length > 0 && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Prueba ofrecida</SelectLabel>
                              {opcionesPruebaDiligencia.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className={COL.descripcion}>
                  {showSelectorTercero && item.ofrecidaPor === 'tercero' && (
                    <Select
                      value={item.terceroNombre?.trim() || '_sin_asignar'}
                      onValueChange={(v) =>
                        onUpdate(item.id, {
                          terceroNombre: v === '_sin_asignar' ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className={cn('h-7 text-[10px] mb-1', compact ? 'h-6' : 'h-7')}>
                        <SelectValue placeholder="Asignar tercero…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_sin_asignar">Sin identificar</SelectItem>
                        {tercerosNombres.map((nombre) => (
                          <SelectItem key={nombre} value={nombre}>
                            {nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {item.tipo === 'pericial' && !compact && (
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      {DESCRIPCION_PERICIAL_LABEL}
                    </p>
                  )}
                  {compact ? (
                    <Input
                      value={item.descripcion}
                      onChange={(e) => onUpdate(item.id, { descripcion: e.target.value })}
                      className="h-7 text-xs"
                      placeholder={item.tipo === 'pericial' ? DESCRIPCION_PERICIAL_PLACEHOLDER : undefined}
                    />
                  ) : (
                    <ControlPruebaAutoTextarea
                      value={item.descripcion}
                      onChange={(e) => onUpdate(item.id, { descripcion: e.target.value })}
                      minRows={2}
                      className="text-xs min-h-[56px]"
                      placeholder={
                        item.tipo === 'pericial'
                          ? DESCRIPCION_PERICIAL_PLACEHOLDER
                          : item.tipo === 'documental_en_poder'
                            ? 'Ej: extractos bancarios en poder de la demandada...'
                          : categoria === 'diligencia'
                            ? 'Ej: Oficio al Banco Galicia...'
                            : categoria === 'audiencia'
                              ? 'Ej: Audiencia de vista de causa...'
                              : 'Ej: Extracto bancario, testigo García...'
                      }
                    />
                  )}
                  {prog.total > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Subtareas: {prog.completadas}/{prog.total}
                    </p>
                  )}
                  {(categoria === 'diligencia' ||
                    (categoria === 'audiencia' && !esPruebaOfrecida(item))) &&
                    (() => {
                      const padre = pruebaOfrecidaDeHijo(item, allItems);
                      if (!padre) return null;
                      const label = etiquetaPruebaVinculada(padre);
                      if (onFocusItem) {
                        return (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-[10px] text-violet-800 font-normal mt-0.5"
                            onClick={() => onFocusItem(padre.id)}
                            title={padre.descripcion}
                          >
                            {label} →
                          </Button>
                        );
                      }
                      return (
                        <p className="text-[10px] text-violet-800 mt-0.5" title={padre.descripcion}>
                          {label}
                        </p>
                      );
                    })()}
                  {etiquetaResolucion && badgeResolucion && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-normal px-1.5 py-0', badgeResolucion)}
                      >
                        {etiquetaResolucion}
                      </Badge>
                      {item.estado === 'contestacion_parcial' && item.diligencia?.oficioSucesorId && onFocusItem && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-[10px] text-fuchsia-800"
                          onClick={() => onFocusItem(item.diligencia!.oficioSucesorId!)}
                        >
                          Ver aclaración →
                        </Button>
                      )}
                    </div>
                  )}
                  {usaFlujoDocumentalEnPoder(item) && (
                    intimacionDocumentalActiva(String(item.estado)) ||
                    item.estado === 'apercibimiento_en_contra' ? (
                      <ControlPruebaCedulasIntimacionDocumentalEnlaces
                        item={item}
                        allItems={allItems}
                        onAddCedula={
                          onAddCedulaVinculada ? () => onAddCedulaVinculada(item.id) : undefined
                        }
                        onFocusSubproceso={onFocusItem}
                      />
                    ) : (
                      <p className="text-[10px] mt-0.5 text-violet-800 leading-snug whitespace-normal">
                        {item.estado === 'postpuesta_juez'
                          ? 'Postergada — pedir intimación'
                          : 'Sin intimación — documental en poder de contraparte'}
                      </p>
                    )
                  )}
                  {usaFlujoAutenticidadDocumental(item) && item.estado === 'autenticidad_impugnada' && (
                    <ControlPruebaOficiosAutenticidadEnlaces
                      item={item}
                      allItems={allItems}
                      onAddOficio={
                        onAddOficioAutenticidad
                          ? (destinatario) => onAddOficioAutenticidad(item.id, destinatario)
                          : undefined
                      }
                      onFocusSubproceso={onFocusItem}
                    />
                  )}
                  {categoria === 'prueba' && usaFlujoAudienciaParte(item) && (
                    <ControlPruebaAudienciaEventoEnlaces
                      item={item}
                      allItems={allItems}
                      onFocusSubproceso={onFocusItem}
                      onNuevaAudiencia={
                        onNuevaAudienciaVinculada
                          ? () => onNuevaAudienciaVinculada(item.id)
                          : undefined
                      }
                    />
                  )}
                  {categoria === 'audiencia' && esEventoAudienciaPrueba(item) && (
                    <>
                      <ControlPruebaCedulasAudienciaEnlaces
                        item={item}
                        allItems={allItems}
                        onAddCedula={
                          onAddCedulaVinculada ? () => onAddCedulaVinculada(item.id) : undefined
                        }
                        onFocusSubproceso={onFocusItem}
                      />
                    </>
                  )}
                </TableCell>
                {usaColumnaObservaciones(categoria) && (
                  <TableCell className={COL.observaciones}>
                    <Textarea
                      value={item.observaciones ?? ''}
                      onChange={(e) =>
                        onUpdate(item.id, { observaciones: e.target.value || null })
                      }
                      rows={compact ? 2 : 3}
                      className={cn(
                        'w-full text-xs resize-y',
                        compact ? 'min-h-[56px]' : 'min-h-[72px]',
                      )}
                      placeholder={placeholderObservaciones(categoria, compact)}
                    />
                  </TableCell>
                )}
                {categoria === 'mejor_proveer' && (
                  <TableCell className={COL.obligada}>
                    <Select
                      value={item.ofrecidaPor ?? 'actor'}
                      onValueChange={(v) => onUpdate(item.id, { ofrecidaPor: v as PruebaParte })}
                    >
                      <SelectTrigger className={cn('text-xs', compact ? 'h-7' : 'h-8')}>
                        <SelectValue>
                          {PARTE_LABELS[item.ofrecidaPor ?? 'actor'] ?? item.ofrecidaPor ?? 'actor'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PARTES_MEJOR_PROVEER.map((p) => (
                          <SelectItem key={p} value={p}>{PARTE_LABELS[p] ?? p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className={COL.estado}>
                  <Select
                    value={
                      esEventoAudienciaPrueba(item)
                        ? coerceEstadoAudienciaItem(item)
                        : String(item.estado)
                    }
                    onValueChange={(v) =>
                      onUpdate(
                        item.id,
                        esEventoAudienciaPrueba(item)
                          ? {
                              estado:
                                v === 'producida' || v === 'valoracion_judicial' ? 'realizada' : v,
                            }
                          : esAudienciaOfrecida(item) && resolveCategoria(item) === 'prueba'
                            ? patchEstadoPruebaOfrecida(item, v)
                            : categoria === 'audiencia'
                              ? { estado: v }
                              : patchEstadoPruebaOfrecida(item, v),
                      )
                    }
                  >
                    <SelectTrigger className={cn('text-xs border', compact ? 'h-7' : 'h-8', estadoCfg.badgeClass)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosItem.map((e) => {
                        const cfg = getEstadoConfig(categoria, e, item);
                        return (
                          <SelectItem key={e} value={e}>
                            <span className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', cfg.dotClass)} />
                              {cfg.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className={COL.fecha}>
                  <div className="space-y-1">
                    {usaFlujoDocumentalEnPoder(item) ? (
                      <>
                        {item.estado === 'postpuesta_juez' ? (
                          <p className="text-[10px] text-orange-700 leading-tight">Postergada — pedir intimación</p>
                        ) : item.estado === 'apercibimiento_en_contra' ? (
                          <p className="text-[10px] text-rose-800 leading-tight">
                            Apercibimiento en contra
                          </p>
                        ) : intimacionDocumentalActiva(String(item.estado)) ? (
                          <>
                            {expanded ? (
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                Plazo exhibición: {item.documentalEnPoder?.plazoPresentacion ?? item.fechaLimite ?? '—'}
                              </p>
                            ) : (
                              <ControlPruebaDeferredInput
                                type="date"
                                compact={compact}
                                value={item.documentalEnPoder?.plazoPresentacion ?? item.fechaLimite ?? ''}
                                onCommit={(plazoPresentacion) =>
                                  onUpdate(item.id, patchDocumentalEnPoder(item, { plazoPresentacion }))
                                }
                                className={cn(
                                  'text-xs',
                                  compact ? 'h-7' : 'h-8',
                                  alerta?.nivel === 'rojo' && 'border-red-400 bg-red-50/50',
                                  alerta?.nivel === 'amarillo' && 'border-amber-400 bg-amber-50/50',
                                )}
                              />
                            )}
                            {contarSubprocesosActivos(item.id, allItems) > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                {contarSubprocesosActivos(item.id, allItems)} cédula(s)
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground leading-tight">Sin plazo — intimación pendiente</p>
                        )}
                      </>
                    ) : esEventoAudienciaPrueba(item) ? (
                      <>
                        <ControlPruebaDeferredInput
                          type="date"
                          compact={compact}
                          value={item.fechaLimite ?? ''}
                          onCommit={(fecha) => onUpdate(item.id, patchFechaEventoAudiencia(item, fecha))}
                          className={cn('text-xs', compact ? 'h-7' : 'h-8')}
                        />
                        <ControlPruebaDeferredInput
                          type="time"
                          value={item.audiencia?.hora ?? ''}
                          onCommit={(hora) =>
                            onUpdate(item.id, patchEventoAudienciaMeta(item, { hora: hora || undefined }))
                          }
                          className={cn('text-xs mt-1', compact ? 'h-7' : 'h-8')}
                        />
                      </>
                    ) : categoria === 'prueba' && usaFlujoAudienciaParte(item) ? (
                      <p className="text-[10px] text-muted-foreground italic leading-tight">
                        Fecha en audiencia vinculada
                      </p>
                    ) : (
                      <>
                        <ControlPruebaDateField
                          value={item.fechaLimite ?? ''}
                          onChange={(e) => onUpdate(item.id, { fechaLimite: e.target.value || null })}
                          compact={compact}
                          inputClassName={cn(
                            'text-xs',
                            alerta?.nivel === 'rojo' && 'border-red-400 bg-red-50/50',
                            alerta?.nivel === 'amarillo' && 'border-amber-400 bg-amber-50/50',
                          )}
                        />
                        {alerta && (
                          <p className={cn('text-[10px] leading-tight', ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                            {alerta.fechaLimite
                              ? etiquetaDiasHabiles(diasHabilesHasta(item.fechaLimite!))
                              : alerta.mensaje}
                          </p>
                        )}
                        {!item.fechaLimite && plazoSugeridoDiasHabiles(item.tipo) && categoria === 'prueba' && (
                          <p className="text-[10px] text-muted-foreground">
                            CPCC: {plazoSugeridoDiasHabiles(item.tipo)} d. háb.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className={COL.link}>
                  <div className="flex gap-1">
                    <Input
                      value={item.actuacionUrl ?? ''}
                      onChange={(e) => onUpdate(item.id, { actuacionUrl: e.target.value || null })}
                      className={cn('text-xs', compact ? 'h-7' : 'h-8')}
                      placeholder="actuación MEV"
                    />
                    {(item.actuacionUrl || expedienteUrl) && (
                      <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" asChild>
                        <a href={item.actuacionUrl || expedienteUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className={COL.acciones}>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expanded && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={tableColSpan(categoria)} className="p-0">
                    <ControlPruebaItemDetail
                      item={item}
                      expediente={expediente}
                      allItems={allItems}
                      pruebaItems={pruebaItems}
                      diligenciaItems={allItems.filter(
                        (i) => i.categoria === 'diligencia' || ['oficio', 'cedula', 'mandamiento'].includes(i.tipo),
                      )}
                      onUpdate={(patch) => onUpdate(item.id, patch)}
                      onAddCedulaVinculada={onAddCedulaVinculada}
                      onAddOficioAutenticidad={onAddOficioAutenticidad}
                      onReintentarCedulaTestigo={onReintentarCedulaTestigo}
                      onCrearMandamientoTestigo={onCrearMandamientoTestigo}
                      onCrearOficioAclaracion={onCrearOficioAclaracion}
                      onCrearOficioReiteracion={onCrearOficioReiteracion}
                      onAddMovimientoPericial={onAddMovimientoPericial}
                      onUpdateMovimientoPericial={onUpdateMovimientoPericial}
                      onRemoveMovimientoPericial={onRemoveMovimientoPericial}
                      onFocusItem={onFocusItem}
                      compact={compact}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
    </>
  );
}
