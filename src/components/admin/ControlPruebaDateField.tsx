'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const OCULTAR_ICONO_NATIVO =
  '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:w-0 [&::-webkit-calendar-picker-indicator]:pointer-events-none';

type Props = Omit<React.ComponentProps<'input'>, 'type'> & {
  compact?: boolean;
  inputClassName?: string;
};

export function ControlPruebaDateField({
  className,
  inputClassName,
  compact = false,
  ...props
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  const abrirPicker = () => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // showPicker puede fallar si no hubo gesto del usuario
      }
    }
    el.focus();
    el.click();
  };

  const altura = compact ? 'h-7' : 'h-8';
  const icono = compact ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <Input
        ref={ref}
        type="date"
        className={cn('min-w-0 flex-1 px-2', altura, OCULTAR_ICONO_NATIVO, inputClassName)}
        {...props}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('shrink-0', icono)}
        onClick={abrirPicker}
        title="Elegir fecha"
        tabIndex={-1}
      >
        <Calendar className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </Button>
    </div>
  );
}
