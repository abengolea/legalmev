import { Suspense } from 'react';
import { AudienciaCopilot } from '@/components/admin/AudienciaCopilot';
import { AudienciaCopilotGuard } from '@/components/AudienciaCopilotGuard';
import { CopilotoAudienciaHelpButton } from '@/components/CopilotoAudienciaHelpDialog';
import { Loader2 } from 'lucide-react';

export default function CopilotoAudienciasPage() {
  return (
    <AudienciaCopilotGuard>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">Copiloto de Audiencias</h1>
            <p className="text-muted-foreground">
              Asistente para preparar y conducir audiencias a partir del expediente.
            </p>
          </div>
          <CopilotoAudienciaHelpButton />
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <AudienciaCopilot />
        </Suspense>
      </div>
    </AudienciaCopilotGuard>
  );
}
