'use client';

import { CircleHelp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  label?: string;
  children: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export function ControlPruebaHelpHint({ label = 'Ayuda', children, className, side = 'bottom' }: Props) {
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className,
          )}
          aria-label={label}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-72 text-sm leading-relaxed text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}
