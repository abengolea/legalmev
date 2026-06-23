import { AudienciaCopilot } from '@/components/admin/AudienciaCopilot';
import { AudienciaCopilotGuard } from '@/components/AudienciaCopilotGuard';

export default function CopilotoAudienciasPage() {
  return (
    <AudienciaCopilotGuard>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">Copiloto de Audiencias</h1>
          <p className="text-muted-foreground">
            Asistente para preparar y conducir audiencias a partir del expediente.
          </p>
        </div>
        <AudienciaCopilot />
      </div>
    </AudienciaCopilotGuard>
  );
}
