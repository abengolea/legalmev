'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CircleHelp,
  FileText,
  Gavel,
  Lightbulb,
  MessageSquare,
  Scale,
  Users,
} from 'lucide-react';

const PASOS = [
  {
    icon: FileText,
    titulo: '1. Cargá el expediente',
    texto:
      'Subí el PDF que exportaste con LegalMev desde MEV/PJN. Debe tener texto seleccionable (no escaneos). La IA lee el expediente y arma un mapa del caso: partes, hechos, prueba y testigos detectados.',
  },
  {
    icon: Scale,
    titulo: '2. Indicá a quién representás',
    texto:
      'Elegí si actuás por el actor o demandado (civil) o por la defensa o fiscalía (penal). Después de la lectura podés pegar más contexto (de qué va la causa o la lista de testigos) y actualizar: la IA completa cada declarante y sugiere las preguntas.',
  },
  {
    icon: Users,
    titulo: '3. Organizá los declarantes',
    texto:
      'Revisá los testigos del expediente. Preferí completarlos con el contexto extra del paso 1: la IA debe sumar a los declarantes nuevos y cargar las preguntas a realizar. Marcá la bandeja y elegí el declarante activo para verlas.',
  },
  {
    icon: MessageSquare,
    titulo: '4. Anotá preguntas y respuestas en vivo',
    texto:
      'Durante la audiencia, cargá los intercambios que importan para el caso: admisiones, contradicciones, hechos disputados y respuestas evasivas. No hace falta transcribir todo; la IA trabaja mejor con lo relevante y así optimizás el uso de recursos.',
  },
  {
    icon: Gavel,
    titulo: '5. Cerrá con alegatos',
    texto:
      'Al terminar los testimonios, generá un borrador de alegatos de cierre integrando todo lo dicho. Podés adjuntar documentos extra y pedirle a la IA que refine el texto con instrucciones tuyas.',
  },
] as const;

export function CopilotoAudienciaHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={() => setOpen(true)}>
        <CircleHelp className="h-4 w-4" />
        ¿Cómo funciona?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left pr-6">
              <Lightbulb className="h-5 w-5 text-primary shrink-0" />
              Cómo usar el Copiloto de Audiencias
            </DialogTitle>
            <DialogDescription className="text-left">
              Guía rápida para preparar y conducir una audiencia con asistencia de IA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {PASOS.map((paso) => (
              <div key={paso.titulo} className="flex gap-3">
                <div className="mt-0.5 rounded-md bg-primary/10 p-2 h-fit shrink-0">
                  <paso.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{paso.titulo}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{paso.texto}</p>
                </div>
              </div>
            ))}

            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground leading-relaxed space-y-2">
              <p className="font-medium text-foreground">Consejos útiles</p>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>Todo se guarda en la nube: podés retomar la audiencia días después desde el selector superior.</li>
                <li>La IA analiza en segundo plano: podés seguir cargando P/R mientras procesa sugerencias.</li>
                <li>Anotá solo preguntas relevantes, no toda la rutina del interrogatorio: mejores sugerencias y menos consumo de tokens.</li>
                <li>Estamos en fase de prueba: hay límites de declarantes y preguntas. Si los alcanzás, escribinos con sugerencias o para contarnos tu experiencia.</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
