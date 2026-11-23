import { Suspense } from 'react';
import { ControlPruebaPanel } from '@/components/admin/ControlPruebaPanel';
import { ControlPruebaGuard } from '@/components/ControlPruebaGuard';
import { Loader2 } from 'lucide-react';

export default function ControlPruebaPage() {
  return (
    <ControlPruebaGuard>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline">Control de prueba</h1>
          <p className="text-muted-foreground">
            Importá el PDF de la causa, analizá la prueba con inteligencia artificial y controlá su
            producción. Versión de prueba en etapa de evaluación.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <ControlPruebaPanel />
        </Suspense>
      </div>
    </ControlPruebaGuard>
  );
}
