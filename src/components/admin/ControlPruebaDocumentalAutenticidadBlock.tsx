'use client';

import type { ControlPruebaItem, OficioAutenticidadPendiente } from '@/types/control-prueba';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, FileText, Plus, Trash2 } from 'lucide-react';

const ESTADO_LABELS: Record<OficioAutenticidadPendiente['estado'], string> = {
  a_librar: 'A librar',
  librado: 'Librado',
  contestado: 'Contestado',
  no_aplica: 'No aplica',
};

type Props = {
  item: ControlPruebaItem;
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  compact?: boolean;
};

export function ControlPruebaDocumentalAutenticidadBlock({ item, onUpdate, compact }: Props) {
  const doc = item.documental ?? {};
  const autenticidadImpugnada = item.estado === 'autenticidad_impugnada';
  const oficios = doc.oficiosAutenticidad ?? [];

  const patchOficios = (next: OficioAutenticidadPendiente[]) => {
    onUpdate({
      documental: {
        ...doc,
        oficiosAutenticidad: next,
        destinatarioOficio: next[0]?.destinatarioOficio?.trim() || doc.destinatarioOficio || null,
      },
    });
  };

  const patchOficio = (id: string, patch: Partial<OficioAutenticidadPendiente>) => {
    patchOficios(oficios.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const addOficio = () => {
    patchOficios([
      ...oficios,
      {
        id: crypto.randomUUID(),
        referencia: null,
        descripcionDocumento: item.descripcion,
        destinatarioOficio: doc.destinatarioOficio?.trim() || '',
        objetoOficio: `Autenticidad — ${item.descripcion.slice(0, 100)}`,
        estado: 'a_librar',
        itemPruebaId: item.id,
        observaciones: null,
      },
    ]);
  };

  const removeOficio = (id: string) => {
    patchOficios(oficios.filter((o) => o.id !== id));
  };

  return (
    <div className={cn('rounded-lg border border-fuchsia-200 bg-fuchsia-50/30 p-3 space-y-3', compact && 'p-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-fuchsia-900">
          <FileText className="h-3.5 w-3.5" />
          Documental acompañada — autenticidad
        </Label>
        {autenticidadImpugnada ? (
          <Badge variant="outline" className="text-[10px] border-fuchsia-400 text-fuchsia-900 bg-fuchsia-50">
            Documental negada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Sin impugnación
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Documental que esta parte ya acompañó. Si la contraparte <strong>niega o impugna la autenticidad</strong>,
        cambiá el estado a <strong>Autenticidad impugnada</strong> y registrá acá los oficios a librar.
      </p>

      {!autenticidadImpugnada && (
        <p className="text-[10px] text-muted-foreground">
          Sin impugnación registrada — el ítem queda como documental admitida.
        </p>
      )}

      {autenticidadImpugnada && (
        <div className="border-t border-fuchsia-200/80 pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium flex items-center gap-1.5 text-rose-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              Oficios de autenticidad a librar
            </Label>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={addOficio}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar
            </Button>
          </div>

          {oficios.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Agregá al menos un oficio con el destinatario que debe certificar la autenticidad.
            </p>
          ) : (
            <ul className="space-y-2">
              {oficios.map((o) => (
                <li key={o.id} className="rounded-lg border bg-background/90 p-2.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {o.referencia && (
                        <Badge variant="outline" className="text-[10px]">
                          {o.referencia}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          o.estado === 'a_librar'
                            ? 'text-[10px] border-rose-400 text-rose-800'
                            : 'text-[10px]'
                        }
                      >
                        {ESTADO_LABELS[o.estado]}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeOficio(o.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-[10px]">Destinatario del oficio</Label>
                      <Input
                        value={o.destinatarioOficio}
                        onChange={(e) => patchOficio(o.id, { destinatarioOficio: e.target.value })}
                        placeholder="ARBA, Banco Nación, escribano…"
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Estado</Label>
                      <Select
                        value={o.estado}
                        onValueChange={(v) =>
                          patchOficio(o.id, { estado: v as OficioAutenticidadPendiente['estado'] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-0.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTADO_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Objeto del oficio (opcional)</Label>
                    <Input
                      value={o.objetoOficio ?? ''}
                      onChange={(e) => patchOficio(o.id, { objetoOficio: e.target.value || null })}
                      className="h-8 text-xs mt-0.5"
                      placeholder="Certificar autenticidad de…"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
