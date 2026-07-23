'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ParteRepresentadaPrueba } from '@/types/control-prueba';

type Props = {
  value: ParteRepresentadaPrueba[];
  onChange: (partes: ParteRepresentadaPrueba[]) => void;
  actorLabel?: string;
  demandadoLabel?: string;
  terceroLabel?: string;
  showTercero?: boolean;
  disabled?: boolean;
  className?: string;
  hint?: string;
};

function toggleParte(
  current: ParteRepresentadaPrueba[],
  parte: ParteRepresentadaPrueba,
  checked: boolean,
): ParteRepresentadaPrueba[] {
  if (checked) {
    return current.includes(parte) ? current : [...current, parte];
  }
  return current.filter((p) => p !== parte);
}

export function ControlPruebaPartesRepresentadasPicker({
  value,
  onChange,
  actorLabel = 'Actor',
  demandadoLabel = 'Demandada',
  terceroLabel = 'Tercero',
  showTercero = true,
  disabled,
  className,
  hint = 'Podés marcar varias. El badge de pendientes suma la prueba de todas las partes elegidas; cada pestaña sigue mostrando su propio conteo.',
}: Props) {
  const options: { id: ParteRepresentadaPrueba; title: string; subtitle: string }[] = [
    { id: 'actor', title: 'Actor', subtitle: actorLabel },
    { id: 'demandado', title: 'Demandada', subtitle: demandadoLabel },
  ];
  if (showTercero) {
    options.push({ id: 'tercero', title: 'Tercero', subtitle: terceroLabel });
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>Representamos a</Label>
      <div className="space-y-1.5 rounded-md border bg-background p-2">
        {options.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted/50',
                disabled && 'pointer-events-none opacity-60',
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => onChange(toggleParte(value, opt.id, v === true))}
                className="mt-0.5"
              />
              <span className="min-w-0 leading-snug">
                <span className="font-medium">{opt.title}</span>
                {opt.subtitle && opt.subtitle !== opt.title ? (
                  <span className="text-muted-foreground"> · {opt.subtitle}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
