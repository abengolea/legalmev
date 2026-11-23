'use client';

import { FileUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  onImportPdf: () => void;
  onAddManual: () => void;
  canEdit?: boolean;
};

export function ControlPruebaEmptyItemsState({ onImportPdf, onAddManual, canEdit = true }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-10 text-center">
        <div className="mx-auto max-w-lg space-y-2">
          <h3 className="text-base font-semibold">
            Este expediente todavía no tiene medidas probatorias cargadas.
          </h3>
          <p className="text-sm text-muted-foreground">
            Podés importar el PDF del expediente para que LegalMev identifique automáticamente la
            prueba ofrecida, o incorporar las medidas manualmente.
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={onImportPdf}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar PDF y analizar con IA
            </Button>
            <Button variant="outline" onClick={onAddManual}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar prueba manualmente
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Este expediente está en solo lectura.</p>
        )}
      </CardContent>
    </Card>
  );
}
