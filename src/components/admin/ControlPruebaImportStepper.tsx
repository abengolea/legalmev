'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  IMPORT_STAGES,
  importProgressMessage,
  resolveImportStageStatuses,
  type ImportWizardProgress,
} from '@/lib/control-prueba-import-ux';

type Props = {
  progress: ImportWizardProgress;
  className?: string;
};

export function ControlPruebaImportStepper({ progress, className }: Props) {
  const statuses = resolveImportStageStatuses(progress);
  const message = importProgressMessage(progress);

  return (
    <div className={cn('space-y-3', className)}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {IMPORT_STAGES.map((stage, index) => {
          const status = statuses[stage.id];
          return (
            <li
              key={stage.id}
              className={cn(
                'rounded-lg border px-2.5 py-2',
                status === 'current' && 'border-primary/40 bg-primary/5',
                status === 'done' && 'border-emerald-200 bg-emerald-50/60',
                status === 'pending' && 'border-border bg-muted/20',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    status === 'current' && 'bg-primary text-primary-foreground',
                    status === 'done' && 'bg-emerald-600 text-white',
                    status === 'pending' && 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {status === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-medium leading-tight',
                    status === 'pending' && 'text-muted-foreground',
                  )}
                >
                  {stage.label}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{stage.hint}</p>
              <p className="sr-only">
                {status === 'done' ? 'Finalizada' : status === 'current' ? 'En curso' : 'Pendiente'}
              </p>
            </li>
          );
        })}
      </ol>
      {message ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
