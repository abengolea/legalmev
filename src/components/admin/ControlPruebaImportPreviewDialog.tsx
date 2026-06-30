'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ImportPreviewPayload } from '@/lib/control-prueba-import-apply';
import type { ControlPruebaItem, ItemCategoria } from '@/types/control-prueba';
import { PARTE_LABELS, TIPO_LABELS, getEstadoConfig } from '@/lib/control-prueba';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  preview: ImportPreviewPayload | null;
  confirming: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedIds: string[]) => void;
};

export function ControlPruebaImportPreviewDialog({
  open,
  preview,
  confirming,
  onOpenChange,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const itemIds = useMemo(() => preview?.items.map((i) => i.id) ?? [], [preview]);

  useEffect(() => {
    if (preview?.items.length) {
      setSelected(new Set(preview.items.map((i) => i.id)));
    }
  }, [preview]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisá el import antes de guardar</DialogTitle>
          <DialogDescription>
            Confirmá qué ítems entrar al control de prueba. Podés desmarcar actos que la IA haya pasado de filtro.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[min(60vh,520px)]">
          <div className="space-y-4 pb-2">
            {(preview.resumenEjecutivo?.aLibrar?.length ||
              preview.resumenEjecutivo?.pendiente?.length ||
              preview.resumenEjecutivo?.producida?.length) && (
              <ResumenBlock resumen={preview.resumenEjecutivo} />
            )}

            {preview.oficiosAutenticidadPendientes.length > 0 && (
              <Alert className="border-rose-300/80 bg-rose-50/90 text-rose-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  <strong>{preview.oficiosAutenticidadPendientes.length} oficio(s) de autenticidad</strong>{' '}
                  detectados (documental negada). Se cargarán en el panel para seguimiento al confirmar.
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

            <div className="flex items-center justify-between gap-2">
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
                />
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
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
}: {
  item: ControlPruebaItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const cat = item.categoria ?? 'prueba';
  const estado = getEstadoConfig(cat as ItemCategoria, item.estado, item);
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3 text-sm transition-colors',
        checked ? 'bg-background' : 'bg-muted/30 opacity-70',
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {cat}/{TIPO_LABELS[item.tipo] ?? item.tipo}
          </Badge>
          <Badge className={cn('text-[10px] border', estado.badgeClass)}>{estado.label}</Badge>
          <span className="text-[10px] text-muted-foreground">
            {PARTE_LABELS[item.ofrecidaPor ?? 'actor'] ?? item.ofrecidaPor}
          </span>
        </div>
        <p className="leading-snug">{item.descripcion}</p>
        {item.observaciones && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.observaciones}</p>
        )}
      </div>
    </div>
  );
}

function ResumenBlock({
  resumen,
}: {
  resumen: NonNullable<ImportPreviewPayload['resumenEjecutivo']>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 text-xs">
      {resumen.producida?.length ? (
        <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/80 p-2">
          <p className="font-medium text-emerald-900 mb-1">Producida</p>
          <ul className="text-emerald-900/90 space-y-0.5">
            {resumen.producida.slice(0, 4).map((t, i) => (
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
            {resumen.pendiente.slice(0, 4).map((t, i) => (
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
            {resumen.aLibrar.slice(0, 4).map((t, i) => (
              <li key={i} className="line-clamp-2">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
