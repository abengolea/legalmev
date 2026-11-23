'use client';

import { FileSearch, FileUp, ListChecks, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { markControlPruebaOnboardingSeen } from '@/lib/control-prueba-onboarding';

const STEPS = [
  {
    n: '1',
    icon: FileUp,
    title: 'Importá el expediente',
    text: 'Subí el PDF de tu expediente judicial.',
  },
  {
    n: '2',
    icon: Sparkles,
    title: 'Analizá con IA',
    text: 'LegalMev identifica las medidas probatorias contenidas en las actuaciones.',
  },
  {
    n: '3',
    icon: ListChecks,
    title: 'Revisá los resultados',
    text: 'Confirmá o corregí las medidas identificadas.',
  },
  {
    n: '4',
    icon: FileSearch,
    title: 'Controlá la prueba',
    text: 'Consultá pendientes, actualizá estados y supervisá el avance del proceso.',
  },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartWithPdf: () => void;
  canCreate?: boolean;
  quotaHint?: string | null;
};

export function ControlPruebaOnboardingDialog({
  open,
  onOpenChange,
  onStartWithPdf,
  canCreate = true,
  quotaHint,
}: Props) {
  const dismiss = (nextOpen: boolean) => {
    if (!nextOpen) markControlPruebaOnboardingSeen();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bienvenido a Control de Prueba</DialogTitle>
          <DialogDescription>
            Organizá y supervisá la producción de la prueba de tus expedientes judiciales con ayuda
            de inteligencia artificial. LegalMev identifica las medidas probatorias y facilita su
            seguimiento.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 py-1">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {step.n}. {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        {quotaHint ? <p className="text-xs text-amber-800">{quotaHint}</p> : null}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            className="w-full"
            onClick={() => {
              markControlPruebaOnboardingSeen();
              onOpenChange(false);
              window.setTimeout(onStartWithPdf, 150);
            }}
            disabled={!canCreate}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Comenzar con un PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
