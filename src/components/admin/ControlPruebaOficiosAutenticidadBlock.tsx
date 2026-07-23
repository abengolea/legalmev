'use client';

import type { OficioAutenticidadPendiente } from '@/types/control-prueba';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

const ESTADO_LABELS: Record<OficioAutenticidadPendiente['estado'], string> = {
  a_librar: 'A librar',
  librado: 'Librado',
  contestado: 'Contestado',
  no_aplica: 'No aplica',
};

type Props = {
  oficios: OficioAutenticidadPendiente[];
  onChange: (oficios: OficioAutenticidadPendiente[]) => void;
};

export function ControlPruebaOficiosAutenticidadBlock({ oficios, onChange }: Props) {
  const aLibrar = oficios.filter((o) => o.estado === 'a_librar').length;

  const patch = (id: string, patch: Partial<OficioAutenticidadPendiente>) => {
    onChange(oficios.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const remove = (id: string) => {
    onChange(oficios.filter((o) => o.id !== id));
  };

  const add = () => {
    onChange([
      ...oficios,
      {
        id: crypto.randomUUID(),
        referencia: null,
        descripcionDocumento: '',
        destinatarioOficio: '',
        objetoOficio: null,
        estado: 'a_librar',
        itemPruebaId: null,
        observaciones: null,
      },
    ]);
  };

  if (oficios.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Oficios de autenticidad
          </CardTitle>
          <CardDescription className="text-xs">
            Cuando documental acompañada fue negada, podés registrar acá los oficios a librar.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar oficio
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-rose-500 bg-rose-50/20">
      <CardHeader className="flex flex-row items-start justify-between py-3 gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Oficios de autenticidad a librar
            {aLibrar > 0 && (
              <Badge className="bg-rose-100 text-rose-900 border-rose-300">{aLibrar} pend.</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Documental negada → oficios de autenticidad. Seguimiento manual del abogado.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {oficios.map((o) => (
          <div key={o.id} className="rounded-lg border bg-background/80 p-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {o.referencia && (
                  <Badge variant="outline" className="text-[10px]">
                    {o.referencia}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    o.estado === 'a_librar'
                      ? 'border-rose-400 text-rose-800'
                      : o.estado === 'librado'
                        ? 'border-amber-400 text-amber-800'
                        : ''
                  }
                >
                  {ESTADO_LABELS[o.estado]}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(o.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{o.descripcionDocumento}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[10px]">Destinatario del oficio</Label>
                <Input
                  value={o.destinatarioOficio}
                  onChange={(e) => patch(o.id, { destinatarioOficio: e.target.value })}
                  placeholder="Banco Santander Río, Assist Card…"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Estado</Label>
                <Select value={o.estado} onValueChange={(v) => patch(o.id, { estado: v as OficioAutenticidadPendiente['estado'] })}>
                  <SelectTrigger className="h-8 text-xs">
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
                onChange={(e) => patch(o.id, { objetoOficio: e.target.value || null })}
                className="h-8 text-xs"
                placeholder="Que informe sobre autenticidad de…"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
