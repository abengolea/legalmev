'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImportPreviewPayload } from '@/lib/control-prueba-import-apply';
import { collectOficiosAutenticidadFromItems } from '@/lib/control-prueba-documental-autenticidad-consolidate';
import { PARTE_LABELS, TIPO_LABELS, getEstadoConfig } from '@/lib/control-prueba';
import { resumenParaParteRepresentada } from '@/lib/control-prueba-resumen';
import type { ControlPruebaItem, ItemCategoria, ParteRepresentadaPrueba, PruebaParte } from '@/types/control-prueba';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  preview: ImportPreviewPayload | null;
  confirming: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedIds: string[]) => void;
  onPreviewChange: (preview: ImportPreviewPayload) => void;
  parteRepresentada: ParteRepresentadaPrueba | '';
  onParteRepresentadaChange: (parte: ParteRepresentadaPrueba | '') => void;
};

export function ControlPruebaImportPreviewDialog({
  open,
  preview,
  confirming,
  onOpenChange,
  onConfirm,
  onPreviewChange,
  parteRepresentada,
  onParteRepresentadaChange,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const itemIds = useMemo(() => preview?.items.map((i) => i.id) ?? [], [preview]);

  useEffect(() => {
    if (preview?.items.length) {
      setSelected(new Set(preview.items.map((i) => i.id)));
    }
  }, [preview?.items]);

  const oficiosPreview = useMemo(
    () => (preview ? collectOficiosAutenticidadFromItems(preview.items) : []),
    [preview],
  );

  const resumenVisible = useMemo(() => {
    if (!preview) return undefined;
    return resumenParaParteRepresentada(
      preview.items,
      oficiosPreview,
      parteRepresentada,
      preview.resumenEjecutivo,
      preview.actor,
      preview.demandado,
    );
  }, [preview, parteRepresentada, oficiosPreview]);

  const updatePreviewItems = (items: ControlPruebaItem[]) => {
    if (!preview) return;
    const next: ImportPreviewPayload = {
      ...preview,
      items,
      parteRepresentada,
      resumenEjecutivo: resumenParaParteRepresentada(
        items,
        collectOficiosAutenticidadFromItems(items),
        parteRepresentada,
        preview.resumenEjecutivo,
        preview.actor,
        preview.demandado,
      ),
    };
    onPreviewChange(next);
    setSelected((prev) => {
      const ids = new Set(items.map((i) => i.id));
      return new Set([...prev].filter((id) => ids.has(id)));
    });
  };

  const patchItem = (id: string, patch: Partial<ControlPruebaItem>) => {
    if (!preview) return;
    updatePreviewItems(preview.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = (id: string) => {
    if (!preview) return;
    updatePreviewItems(preview.items.filter((i) => i.id !== id));
  };

  const handleParteChange = (parte: ParteRepresentadaPrueba | '') => {
    onParteRepresentadaChange(parte);
    if (!preview) return;
    onPreviewChange({
      ...preview,
      parteRepresentada: parte,
      resumenEjecutivo: resumenParaParteRepresentada(
        preview.items,
        oficiosPreview,
        parte,
        preview.resumenEjecutivo,
        preview.actor,
        preview.demandado,
      ),
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(itemIds) : new Set());
  };

  if (!preview) return null;

  const allSelected = selected.size === preview.items.length && preview.items.length > 0;
  const actorLabel = preview.actor?.trim() || 'Actor';
  const demandadoLabel = preview.demandado?.trim() || 'Demandada';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] h-[min(90vh,820px)] max-w-3xl flex-col gap-3 overflow-hidden p-6 sm:rounded-lg">
        <DialogHeader className="shrink-0 space-y-1.5 pr-6">
          <DialogTitle>Revisá el import antes de guardar</DialogTitle>
          <DialogDescription>
            Indicá a quién representás, editá o eliminá ítems incorrectos y confirmá qué entra al control.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <Label className="text-xs font-medium text-primary">Representamos a</Label>
          <Select
            value={parteRepresentada || '_'}
            onValueChange={(v) =>
              handleParteChange(v === '_' ? '' : (v as ParteRepresentadaPrueba))
            }
          >
            <SelectTrigger className="h-9 bg-background">
              <SelectValue placeholder="Seleccioná la parte…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Sin definir (resumen de ambas partes)</SelectItem>
              <SelectItem value="actor">{actorLabel}</SelectItem>
              <SelectItem value="demandado">{demandadoLabel}</SelectItem>
            </SelectContent>
          </Select>
          {parteRepresentada && (
            <p className="text-[11px] text-muted-foreground">
              El resumen ejecutivo mostrará solo la prueba de{' '}
              {parteRepresentada === 'actor' ? actorLabel : demandadoLabel}.
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1">
          <div className="space-y-4 pb-2">
            {(resumenVisible?.aLibrar?.length ||
              resumenVisible?.pendiente?.length ||
              resumenVisible?.producida?.length) && (
              <ResumenBlock resumen={resumenVisible} nuestraParte={!!parteRepresentada} />
            )}

            {oficiosPreview.length > 0 && (
              <Alert className="border-rose-300/80 bg-rose-50/90 text-rose-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  <strong>{oficiosPreview.length} oficio(s) de autenticidad</strong>{' '}
                  en documental negada. Quedan embebidos en cada ítem documental al confirmar.
                </AlertDescription>
              </Alert>
            )}

            {preview.descartados.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  {preview.descartados.length} actos procesales descartados (no son prueba ofrecida)
                </p>
                <ul className="space-y-0.5 list-disc pl-4">
                  {preview.descartadosMuestra.slice(0, 6).map((d, i) => (
                    <li key={i} className="line-clamp-1">
                      {d.descripcion.slice(0, 90)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1">
              <p className="text-sm font-medium">
                Ítems a importar ({selected.size}/{preview.items.length})
              </p>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                Seleccionar todos
              </label>
            </div>

            <div className="space-y-2">
              {preview.items.map((item) => (
                <PreviewItemRow
                  key={item.id}
                  item={item}
                  checked={selected.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onPatch={(patch) => patchItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>

            {preview.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No quedan ítems. Volvé atrás o importá de nuevo.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Volver
          </Button>
          <Button
            onClick={() => onConfirm([...selected])}
            disabled={confirming || selected.size === 0}
          >
            {confirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmar import ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewItemRow({
  item,
  checked,
  onToggle,
  onPatch,
  onRemove,
}: {
  item: ControlPruebaItem;
  checked: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<ControlPruebaItem>) => void;
  onRemove: () => void;
}) {
  const cat = item.categoria ?? 'prueba';
  const estado = getEstadoConfig(cat as ItemCategoria, item.estado, item);
  return (
    <div
      className={cn(
        'flex gap-2 rounded-lg border p-3 text-sm transition-colors',
        checked ? 'bg-background' : 'bg-muted/30 opacity-70',
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {cat}/{TIPO_LABELS[item.tipo] ?? item.tipo}
          </Badge>
          <Badge className={cn('text-[10px] border', estado.badgeClass)}>{estado.label}</Badge>
          <Select
            value={item.ofrecidaPor ?? 'actor'}
            onValueChange={(v) => onPatch({ ofrecidaPor: v as PruebaParte })}
          >
            <SelectTrigger className="h-6 w-[110px] text-[10px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="actor">{PARTE_LABELS.actor}</SelectItem>
              <SelectItem value="demandado">{PARTE_LABELS.demandado}</SelectItem>
              <SelectItem value="tercero">{PARTE_LABELS.tercero}</SelectItem>
              <SelectItem value="tribunal">{PARTE_LABELS.tribunal}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={item.descripcion}
          onChange={(e) => onPatch({ descripcion: e.target.value })}
          className="h-8 text-xs"
        />
        {item.observaciones && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.observaciones}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        title="Eliminar del import"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ResumenBlock({
  resumen,
  nuestraParte,
}: {
  resumen: NonNullable<ImportPreviewPayload['resumenEjecutivo']>;
  nuestraParte: boolean;
}) {
  return (
    <div className="space-y-1">
      {nuestraParte && (
        <p className="text-[11px] font-medium text-primary">Resumen — nuestra prueba</p>
      )}
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        {resumen.producida?.length ? (
          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/80 p-2">
            <p className="font-medium text-emerald-900 mb-1">Producida</p>
            <ul className="text-emerald-900/90 space-y-0.5">
              {resumen.producida.slice(0, 6).map((t, i) => (
                <li key={i} className="line-clamp-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {resumen.pendiente?.length ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-2">
            <p className="font-medium text-amber-900 mb-1">Pendiente</p>
            <ul className="text-amber-900/90 space-y-0.5">
              {resumen.pendiente.slice(0, 6).map((t, i) => (
                <li key={i} className="line-clamp-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {resumen.aLibrar?.length ? (
          <div className="rounded-lg border border-rose-300/60 bg-rose-50/80 p-2">
            <p className="font-medium text-rose-900 mb-1">A librar</p>
            <ul className="text-rose-900/90 space-y-0.5">
              {resumen.aLibrar.slice(0, 6).map((t, i) => (
                <li key={i} className="line-clamp-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
