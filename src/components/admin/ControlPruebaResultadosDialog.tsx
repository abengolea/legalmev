'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  getParameterValue,
  patchFromParameterValues,
  resolveParameterCatalog,
  type ParameterFieldDef,
} from '@/lib/control-prueba-parameter-catalog';
import { getEstadoConfig, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import { labelTipoPrueba } from '@/lib/control-prueba-pericial';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck } from 'lucide-react';

type Props = {
  open: boolean;
  item: ControlPruebaItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, patch: Partial<ControlPruebaItem>) => void;
};

function buildInitialValues(item: ControlPruebaItem): Record<string, string | boolean> {
  const entry = resolveParameterCatalog(item);
  const values: Record<string, string | boolean> = {};
  for (const field of entry.fields) {
    values[field.path] = getParameterValue(item, field.path);
  }
  return values;
}

function FieldInput({
  field,
  value,
  item,
  onChange,
}: {
  field: ParameterFieldDef;
  value: string | boolean;
  item: ControlPruebaItem;
  onChange: (path: string, value: string | boolean) => void;
}) {
  const id = `resultado-${field.path.replace(/\./g, '-')}`;

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id={id}
          checked={value === true || value === 'true'}
          onCheckedChange={(v) => onChange(field.path, v === true)}
        />
        <Label htmlFor={id} className="text-xs font-normal cursor-pointer">
          {field.label}
        </Label>
      </div>
    );
  }

  if (field.type === 'select' && field.options?.length) {
    const cat = resolveCategoria(item);
    return (
      <div>
        <Label htmlFor={id} className="text-xs">
          {field.label}
        </Label>
        <Select value={String(value || '')} onValueChange={(v) => onChange(field.path, v)}>
          <SelectTrigger id={id} className="h-9 text-xs mt-0.5">
            <SelectValue placeholder="Seleccionar…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label || getEstadoConfig(cat, o.value, item).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <Label htmlFor={id} className="text-xs">
          {field.label}
        </Label>
        <Textarea
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.path, e.target.value)}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          className="text-xs mt-0.5 min-h-[60px]"
        />
        {field.hint && <p className="text-[10px] text-muted-foreground mt-0.5">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {field.label}
      </Label>
      <Input
        id={id}
        type={field.type === 'date' ? 'date' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.path, e.target.value)}
        placeholder={field.placeholder}
        className="h-9 text-xs mt-0.5"
      />
      {field.hint && <p className="text-[10px] text-muted-foreground mt-0.5">{field.hint}</p>}
    </div>
  );
}

export function ControlPruebaResultadosDialog({ open, item, onOpenChange, onSave }: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  const entry = useMemo(() => (item ? resolveParameterCatalog(item) : null), [item]);

  useEffect(() => {
    if (item && open) {
      setValues(buildInitialValues(item));
    }
  }, [item, open]);

  if (!item || !entry) return null;

  const cat = resolveCategoria(item);
  const estadoCfg = getEstadoConfig(cat, String(item.estado), item);

  const handleChange = (path: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [path]: value }));
  };

  const handleSave = () => {
    const patch = patchFromParameterValues(item, values);
    onSave(item.id, patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            {entry.titulo}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left">
              {entry.descripcion && <p className="text-xs">{entry.descripcion}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  #{item.orden}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {labelTipoPrueba(item) || TIPO_LABELS[item.tipo] || item.tipo}
                </Badge>
                <Badge variant="outline" className={`text-[10px] border ${estadoCfg.badgeClass}`}>
                  {estadoCfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{item.descripcion}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {entry.fields.map((field) =>
            field.type === 'boolean' ? (
              <FieldInput
                key={field.path}
                field={field}
                value={values[field.path] ?? false}
                item={item}
                onChange={handleChange}
              />
            ) : (
              <FieldInput
                key={field.path}
                field={field}
                value={values[field.path] ?? ''}
                item={item}
                onChange={handleChange}
              />
            ),
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ControlPruebaResultadosForm({
  item,
  onSave,
  onCancel,
}: {
  item: ControlPruebaItem;
  onSave: (patch: Partial<ControlPruebaItem>) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(() => buildInitialValues(item));
  const entry = resolveParameterCatalog(item);

  const handleChange = (path: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [path]: value }));
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{entry.titulo}</p>
        {entry.descripcion && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{entry.descripcion}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {entry.fields.map((field) => (
          <div
            key={field.path}
            className={field.type === 'textarea' || field.type === 'boolean' ? 'sm:col-span-2' : ''}
          >
            <FieldInput
              field={field}
              value={field.type === 'boolean' ? (values[field.path] ?? false) : (values[field.path] ?? '')}
              item={item}
              onChange={handleChange}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(patchFromParameterValues(item, values))}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
