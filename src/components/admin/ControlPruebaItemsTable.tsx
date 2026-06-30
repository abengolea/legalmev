'use client';

import { Fragment, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaExpediente, ControlPruebaItem, ItemCategoria, PruebaParte, TipoTramitePericial } from '@/types/control-prueba';
import { PRUEBA_PARTES } from '@/types/control-prueba';
import {
  esAudienciaOfrecida,
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
  patchAudienciaPrueba,
} from '@/lib/control-prueba-audiencia-prueba';
import { patchEstadoPruebaOfrecida } from '@/lib/control-prueba-cierre';
import {
  patchDocumentalEnPoder,
  usaFlujoDocumentalEnPoder,
} from '@/lib/control-prueba-documental-poder';
import {
  usaFlujoAutenticidadDocumental,
} from '@/lib/control-prueba-documental-autenticidad';
import { ControlPruebaDeferredInput } from '@/components/admin/ControlPruebaDeferredInput';
import { ControlPruebaItemDetail } from '@/components/admin/ControlPruebaItemDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
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
import { ControlPruebaResultadosDialog } from '@/components/admin/ControlPruebaResultadosDialog';
import { tieneResultadoCargado } from '@/lib/control-prueba-parameter-catalog';
import { ChevronDown, ChevronRight, ClipboardCheck, ExternalLink, Trash2 } from 'lucide-react';

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
  onReintentarCedulaTestigo?: (parentId: string, destinatario: string) => void;
  onCrearMandamientoTestigo?: (parentId: string, testigoNombre: string) => void;
  onCrearOficioAclaracion?: (parentId: string) => void;
  onCrearOficioReiteracion?: (parentId: string) => void;
  onAddMovimientoPericial?: (parentId: string, rol: TipoTramitePericial) => void;
  onUpdateMovimientoPericial?: (movimientoId: string, patch: Partial<ControlPruebaItem>) => void;
  onRemoveMovimientoPericial?: (movimientoId: string) => void;
  onFocusItem?: (itemId: string) => void;
};

const FECHA_PRIMARIA: Record<ItemCategoria, string> = {
  prueba: 'Límite',
  diligencia: 'Plazo',
  audiencia: 'Fecha',
  tramite: 'Plazo',
  mejor_proveer: 'Plazo',
};

const FECHA_SECUNDARIA: Record<ItemCategoria, string> = {
  prueba: 'Producida',
  diligencia: 'Cumplido',
  audiencia: 'Realizada',
  tramite: 'Presentada',
  mejor_proveer: 'Cumplida',
};

function labelFechaPrimaria(categoria: ItemCategoria, items: ControlPruebaItem[]): string {
  if (categoria === 'audiencia' && items.some(esAudienciaOfrecida)) return 'Audiencia';
  if (categoria === 'prueba' && items.some((i) => i.tipo === 'documental_en_poder')) {
    return items.some((i) => i.estado === 'intimacion_ordenada') ? 'Plazo exhibición' : 'Límite';
  }
  return FECHA_PRIMARIA[categoria];
}

function labelFechaSecundaria(categoria: ItemCategoria, items: ControlPruebaItem[]): string {
  if (categoria === 'audiencia' && items.some(esAudienciaOfrecida)) return 'Producida';
  return FECHA_SECUNDARIA[categoria];
}

function labelColumnaParte(categoria: ItemCategoria): string {
  return categoria === 'mejor_proveer' ? 'Obligada' : 'Ofrecida por';
}

function partesParaSelect(categoria: ItemCategoria): readonly PruebaParte[] {
  if (categoria === 'mejor_proveer') {
    return ['actor', 'demandado', 'tercero'] as const;
  }
  return PRUEBA_PARTES;
}

function parteDefaultItem(item: ControlPruebaItem, categoria: ItemCategoria): string {
  if (categoria === 'mejor_proveer') return item.ofrecidaPor ?? 'actor';
  return item.ofrecidaPor ?? 'tribunal';
}

function usaFlujoAudienciaParte(item: ControlPruebaItem): boolean {
  return esAudienciaOfrecida(item);
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
  onReintentarCedulaTestigo,
  onCrearMandamientoTestigo,
  onCrearOficioAclaracion,
  onCrearOficioReiteracion,
  onAddMovimientoPericial,
  onUpdateMovimientoPericial,
  onRemoveMovimientoPericial,
  onFocusItem,
}: ControlItemsTableProps) {
  const allItems = expediente.items ?? items;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [resultadosItem, setResultadosItem] = useState<ControlPruebaItem | null>(null);
  const tipos = TIPOS_POR_CATEGORIA[categoria];
  const opcionesTipo = categoria === 'prueba' ? opcionesTipoPrueba(tipos) : tipos.map((t) => ({ value: t, label: TIPO_LABELS[t] ?? t }));

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
    <Table>
      <TableHeader>
        <TableRow className={compact ? 'h-8' : undefined}>
          <TableHead className="w-8" />
          <TableHead className="w-10">#</TableHead>
          <TableHead className="min-w-[100px]">Tipo</TableHead>
          <TableHead className="min-w-[200px]">Descripción</TableHead>
          {categoria !== 'prueba' && <TableHead className="min-w-[110px]">{labelColumnaParte(categoria)}</TableHead>}
          <TableHead className="min-w-[130px]">Estado</TableHead>
          <TableHead className="min-w-[100px]">{labelFechaPrimaria(categoria, items)}</TableHead>
          <TableHead className="min-w-[100px]">{labelFechaSecundaria(categoria, items)}</TableHead>
          <TableHead className="min-w-[140px]">Link</TableHead>
          <TableHead className="w-10" />
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
                <TableCell className="p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleExpand(item.id)}
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs p-2">{item.orden}</TableCell>
                <TableCell className="p-2">
                  {categoria === 'prueba' ? (
                    <Select
                      value={tipoPruebaSelectValue(item)}
                      onValueChange={(v) => {
                        const parsed = parseTipoPruebaSelectValue(v, item.pericial);
                        onUpdate(item.id, { ...parsed, categoria });
                      }}
                    >
                      <SelectTrigger className={cn('text-xs', compact ? 'h-7' : 'h-8')}>
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
                  ) : (
                    <Select
                      value={item.tipo}
                      onValueChange={(v) =>
                        onUpdate(item.id, {
                          ...patchTipoComunicacion(item, v),
                        })
                      }
                    >
                      <SelectTrigger className={cn('text-xs', compact ? 'h-7' : 'h-8')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map((t) => (
                          <SelectItem key={t} value={t}>{TIPO_LABELS[t] ?? t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="p-2">
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
                    <Textarea
                      value={item.descripcion}
                      onChange={(e) => onUpdate(item.id, { descripcion: e.target.value })}
                      rows={compact ? 1 : 2}
                      className={cn('text-xs', compact ? 'min-h-[28px]' : 'min-h-[56px]')}
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
                    <p className="text-[10px] mt-0.5 text-violet-800">
                      {item.estado === 'postpuesta_juez'
                        ? 'Postergada — pedir intimación'
                        : item.estado === 'intimacion_ordenada'
                          ? 'Intimación ordenada · expandir para cédula'
                          : 'Sin intimación — documental en poder de contraparte'}
                    </p>
                  )}
                  {usaFlujoAutenticidadDocumental(item) && item.estado === 'autenticidad_impugnada' && (
                    <p className="text-[10px] mt-0.5 text-fuchsia-800">
                      Documental negada · expandir para oficios a librar
                    </p>
                  )}
                  {usaFlujoAudienciaParte(item) && (
                    <p className="text-[10px] mt-0.5 text-primary/80">
                      {item.estado === 'postpuesta_juez'
                        ? 'Postergada — pedir fijación'
                        : item.estado === 'audiencia_fijada'
                          ? 'Audiencia fijada · expandir para cédulas'
                          : 'Sin audiencia fijada — use estado Audiencia fijada'}
                    </p>
                  )}
                </TableCell>
                {categoria !== 'prueba' && (
                  <TableCell className="p-2">
                    <Select
                      value={parteDefaultItem(item, categoria)}
                      onValueChange={(v) => onUpdate(item.id, { ofrecidaPor: v as PruebaParte })}
                    >
                      <SelectTrigger className={cn('text-xs', compact ? 'h-7' : 'h-8')}>
                        <SelectValue>
                          {PARTE_LABELS[parteDefaultItem(item, categoria)] ?? parteDefaultItem(item, categoria)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {partesParaSelect(categoria).map((p) => (
                          <SelectItem key={p} value={p}>{PARTE_LABELS[p] ?? p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="p-2">
                  <Select
                    value={String(item.estado)}
                    onValueChange={(v) =>
                      onUpdate(
                        item.id,
                        patchEstadoPruebaOfrecida(item, v),
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
                <TableCell className="p-2">
                  <div className="space-y-1">
                    {usaFlujoDocumentalEnPoder(item) ? (
                      <>
                        {item.estado === 'postpuesta_juez' ? (
                          <p className="text-[10px] text-orange-700 leading-tight">Postergada — pedir intimación</p>
                        ) : item.estado === 'intimacion_ordenada' ? (
                          <>
                            {expanded ? (
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                Plazo exhibición: {item.documentalEnPoder?.plazoPresentacion ?? item.fechaLimite ?? '—'}
                              </p>
                            ) : (
                              <ControlPruebaDeferredInput
                                type="date"
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
                    ) : usaFlujoAutenticidadDocumental(item) && item.estado === 'autenticidad_impugnada' ? (
                      <>
                        {expanded ? (
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            Impugnación: {item.documental?.fechaImpugnacion ?? '—'}
                          </p>
                        ) : (
                          <p className="text-[10px] text-fuchsia-800 leading-tight">
                            {item.documental?.fechaImpugnacion ?? 'Impugnación sin fecha'}
                          </p>
                        )}
                        {contarSubprocesosActivos(item.id, allItems) > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {contarSubprocesosActivos(item.id, allItems)} oficio(s) a librar
                          </p>
                        )}
                      </>
                    ) : usaFlujoAudienciaParte(item) ? (
                      <>
                        {item.estado === 'postpuesta_juez' ? (
                          <p className="text-[10px] text-orange-700 leading-tight">Postergada — pedir fijación</p>
                        ) : item.estado === 'audiencia_fijada' ? (
                          <>
                            {expanded ? (
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {item.audienciaPrueba?.fechaAudiencia ?? '—'}
                                {item.audienciaPrueba?.horaAudiencia
                                  ? ` · ${item.audienciaPrueba.horaAudiencia}`
                                  : ''}
                              </p>
                            ) : (
                              <>
                                <ControlPruebaDeferredInput
                                  type="date"
                                  value={item.audienciaPrueba?.fechaAudiencia ?? ''}
                                  onCommit={(fechaAudiencia) =>
                                    onUpdate(item.id, patchAudienciaPrueba(item, { fechaAudiencia }))
                                  }
                                  className={cn(
                                    'text-xs',
                                    compact ? 'h-7' : 'h-8',
                                    alerta?.nivel === 'rojo' && 'border-red-400 bg-red-50/50',
                                    alerta?.nivel === 'amarillo' && 'border-amber-400 bg-amber-50/50',
                                  )}
                                />
                                <ControlPruebaDeferredInput
                                  type="time"
                                  value={item.audienciaPrueba?.horaAudiencia ?? ''}
                                  onCommit={(horaAudiencia) =>
                                    onUpdate(item.id, patchAudienciaPrueba(item, { horaAudiencia }))
                                  }
                                  className={cn('text-xs mt-1', compact ? 'h-7' : 'h-8')}
                                />
                              </>
                            )}
                            {contarSubprocesosActivos(item.id, allItems) > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                {contarSubprocesosActivos(item.id, allItems)} cédula(s)
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic leading-tight">
                            Audiencia sin fijar
                          </p>
                        )}
                        {alerta && item.estado === 'audiencia_fijada' && (
                          <p className={cn('text-[10px] leading-tight', ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                            {alerta.fechaLimite
                              ? etiquetaDiasHabiles(diasHabilesHasta(item.fechaLimite!))
                              : alerta.mensaje}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          type="date"
                          value={item.fechaLimite ?? ''}
                          onChange={(e) => onUpdate(item.id, { fechaLimite: e.target.value || null })}
                          className={cn(
                            'text-xs',
                            compact ? 'h-7' : 'h-8',
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
                <TableCell className="p-2">
                  <Input
                    type="date"
                    value={item.fechaProduccion ?? ''}
                    onChange={(e) => onUpdate(item.id, { fechaProduccion: e.target.value || null })}
                    className={cn('text-xs', compact ? 'h-7' : 'h-8')}
                  />
                </TableCell>
                <TableCell className="p-2">
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
                <TableCell className="p-1">
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        tieneResultadoCargado(item)
                          ? 'text-primary hover:text-primary'
                          : 'text-muted-foreground hover:text-primary',
                      )}
                      title="Cargar resultado"
                      onClick={() => setResultadosItem(item)}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    </Button>
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
                  <TableCell colSpan={categoria !== 'prueba' ? 10 : 9} className="p-0">
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

    <ControlPruebaResultadosDialog
      open={resultadosItem != null}
      item={resultadosItem}
      onOpenChange={(open) => {
        if (!open) setResultadosItem(null);
      }}
      onSave={(id, patch) => onUpdate(id, patch)}
    />
    </>
  );
}
