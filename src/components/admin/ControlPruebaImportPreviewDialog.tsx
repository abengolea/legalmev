'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImportPreviewPayload } from '@/lib/control-prueba-import-apply';
import { collectOficiosAutenticidadFromItems } from '@/lib/control-prueba-documental-autenticidad-consolidate';
import {
  normalizePartesRepresentadas,
  payloadPartesRepresentadas,
} from '@/lib/control-prueba-partes-representadas';
import { CATEGORIA_CONFIG, PARTE_LABELS, TIPO_LABELS, getEstadoConfig } from '@/lib/control-prueba';
import { countItemsByParte, countItemsByTipo } from '@/lib/control-prueba-import-ux';
import type { ControlPruebaItem, ItemCategoria, ParteRepresentadaPrueba, PruebaParte } from '@/types/control-prueba';
import { ControlPruebaPartesRepresentadasPicker } from '@/components/admin/ControlPruebaPartesRepresentadasPicker';
import { ControlPruebaHelpHint } from '@/components/admin/ControlPruebaHelpHint';
import { ControlPruebaImportStepper } from '@/components/admin/ControlPruebaImportStepper';
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
  partesRepresentadas: ParteRepresentadaPrueba[];
  onPartesRepresentadasChange: (partes: ParteRepresentadaPrueba[]) => void;
};

export function ControlPruebaImportPreviewDialog({
  open,
  preview,
  confirming,
  onOpenChange,
  onConfirm,
  onPreviewChange,
  partesRepresentadas,
  onPartesRepresentadasChange,
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

  const updatePreviewItems = (items: ControlPruebaItem[]) => {
    if (!preview) return;
    const next: ImportPreviewPayload = {
      ...preview,
      items,
      ...payloadPartesRepresentadas(partesRepresentadas),
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

  const handlePartesChange = (partes: ParteRepresentadaPrueba[]) => {
    onPartesRepresentadasChange(partes);
    if (!preview) return;
    onPreviewChange({
      ...preview,
      ...payloadPartesRepresentadas(partes),
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
  const partesNorm = normalizePartesRepresentadas(partesRepresentadas, preview.parteRepresentada);
  const byTipo = countItemsByTipo(preview.items);
  const byParte = countItemsByParte(preview.items);
  const byCategoria = preview.items.reduce<Record<string, number>>((acc, item) => {
    const cat = item.categoria ?? 'prueba';
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] h-[min(90vh,820px)] max-w-3xl flex-col gap-3 overflow-hidden p-6 sm:rounded-lg">
        <DialogHeader className="shrink-0 space-y-1.5 pr-6">
          <DialogTitle>Revisá el import antes de guardar</DialogTitle>
          <DialogDescription>
            Indicá a quién representás, editá o eliminá ítems incorrectos y confirmá qué entra al control.
            Nada se guarda hasta que confirmes.
          </DialogDescription>
        </DialogHeader>

        <ControlPruebaImportStepper
          className="shrink-0"
          progress={{
            hasFile: true,
            extracting: false,
            extracted: true,
            analyzing: false,
            hasPreview: true,
            reviewing: !confirming,
            confirming,
          }}
        />

        <div className="shrink-0 rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {preview.items.length === 1
                ? '1 medida probatoria detectada'
                : `${preview.items.length} medidas probatorias detectadas`}
            </p>
            <p className="text-xs text-muted-foreground">
              {selected.size} seleccionada{selected.size === 1 ? '' : 's'} para importar
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['prueba', 'diligencia', 'audiencia'] as const).map((cat) =>
              (byCategoria[cat] ?? 0) > 0 ? (
                <Badge key={cat} variant="outline" className="text-[10px]">
                  {CATEGORIA_CONFIG[cat].titulo}: {byCategoria[cat]}
                </Badge>
              ) : null,
            )}
            {byParte.map((row) => (
              <Badge key={row.parte} variant="secondary" className="text-[10px]">
                {PARTE_LABELS[row.parte] ?? row.parte}: {row.count}
              </Badge>
            ))}
            {byTipo.slice(0, 6).map((row) => (
              <Badge key={row.tipo} variant="outline" className="text-[10px] font-normal">
                {TIPO_LABELS[row.tipo] ?? row.tipo}: {row.count}
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Los resultados generados mediante IA deben ser revisados por el profesional antes de
            incorporarlos al seguimiento.
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-1">
            <p className="text-xs font-medium">Parte representada</p>
            <ControlPruebaHelpHint label="Ayuda sobre la parte representada">
              Marcá a quién representás en esta causa. El tablero prioriza la prueba de esas partes
              al mostrar pendientes; igual podés revisar y corregir cada medida antes de confirmar.
            </ControlPruebaHelpHint>
          </div>
          <ControlPruebaPartesRepresentadasPicker
            value={partesNorm}
            onChange={handlePartesChange}
            actorLabel={actorLabel}
            demandadoLabel={demandadoLabel}
            showTercero={false}
            hint="En el control vas a priorizar la prueba de las partes marcadas; el badge de pendientes suma todas ellas."
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1">
          <div className="space-y-4 pb-2">
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
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">
                  Ítems a importar ({selected.size}/{preview.items.length})
                </p>
                <ControlPruebaHelpHint label="Ayuda para revisar medidas">
                  Podés desmarcar, editar la descripción, cambiar la parte o eliminar un ítem. Solo
                  las medidas seleccionadas se incorporan al confirmar.
                </ControlPruebaHelpHint>
              </div>
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

        <DialogFooter className="shrink-0 gap-2 sm:flex-row sm:items-center sm:justify-between border-t pt-3">
          <div className="flex items-center gap-1 sm:mr-auto">
            <p className="text-[11px] text-muted-foreground">
              {selected.size} medida{selected.size === 1 ? '' : 's'} lista{selected.size === 1 ? '' : 's'} para incorporar.
            </p>
            <ControlPruebaHelpHint label="Ayuda para confirmar la importación">
              Al confirmar, las medidas seleccionadas quedan guardadas en el expediente. Si volvés
              atrás sin confirmar, el análisis no se incorpora al control.
            </ControlPruebaHelpHint>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
              Volver
            </Button>
            <Button
              className="min-w-[13rem] shadow-sm"
              onClick={() => onConfirm([...selected])}
              disabled={confirming || selected.size === 0}
            >
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar e incorporar al control
            </Button>
          </div>
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
