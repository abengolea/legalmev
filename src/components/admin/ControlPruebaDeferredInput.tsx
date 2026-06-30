'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  type: 'date' | 'time';
  value: string;
  onCommit: (value: string | null) => void;
  className?: string;
};

/** Input fecha/hora con estado local: evita congelar la UI al usar el picker nativo. */
export function ControlPruebaDeferredInput({ type, value, onCommit, className }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draft.trim() || null;
    const current = value.trim() || null;
    if (next !== current) onCommit(next);
  };

  return (
    <Input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(className)}
    />
  );
}
