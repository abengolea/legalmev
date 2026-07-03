'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Props = React.ComponentProps<'textarea'> & {
  minRows?: number;
};

function ajustarAltura(el: HTMLTextAreaElement, minRows: number) {
  const styles = getComputedStyle(el);
  const lineHeight = parseFloat(styles.lineHeight) || 16;
  const padding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const minHeight = lineHeight * minRows + padding;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

export function ControlPruebaAutoTextarea({
  minRows = 2,
  className,
  onChange,
  value,
  ...props
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const ajustar = useCallback(() => {
    if (ref.current) ajustarAltura(ref.current, minRows);
  }, [minRows]);

  useEffect(() => {
    ajustar();
  }, [value, ajustar]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        ajustarAltura(e.currentTarget, minRows);
      }}
      rows={minRows}
      className={cn('resize-none overflow-hidden', className)}
      {...props}
    />
  );
}
