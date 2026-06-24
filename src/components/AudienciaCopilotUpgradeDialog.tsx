'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL } from '@/lib/site-contact';
import type { AudienciaCopilotLimits } from '@/lib/audiencia-copilot-limits';
import { Scale } from 'lucide-react';

export type AudienciaCopilotUpgradeReason =
  | 'intercambios_total'
  | 'intercambios_testigo'
  | 'testigos'
  | 'documentos'
  | 'nueva_audiencia'
  | 'general';

function mensajeLimite(
  reason: AudienciaCopilotUpgradeReason,
  limits: AudienciaCopilotLimits | null | undefined
): { titulo: string; descripcion: string } {
  const maxPr = limits?.maxIntercambiosTotal ?? 100;
  const maxPorTestigo = limits?.maxIntercambiosPerTestigo ?? 25;
  const maxTestigos = limits?.maxTestigos ?? 10;
  const maxDocs = limits?.maxDocumentosAdicionales ?? 3;

  switch (reason) {
    case 'intercambios_total':
      return {
        titulo: 'Alcanzaste el límite de preguntas',
        descripcion: `Llegaste a las ${maxPr} preguntas incluidas en la fase de prueba. Escribinos si necesitás seguir en esta audiencia o querés contarnos cómo te fue.`,
      };
    case 'intercambios_testigo':
      return {
        titulo: 'Límite por declarante',
        descripcion: `En la fase de prueba hay hasta ${maxPorTestigo} preguntas por declarante. Contactanos si necesitás seguir con este testigo.`,
      };
    case 'testigos':
      return {
        titulo: 'Límite de declarantes',
        descripcion: `La fase de prueba admite hasta ${maxTestigos} declarantes. Escribinos si tu causa necesita más testigos.`,
      };
    case 'documentos':
      return {
        titulo: 'Límite de documentos extra',
        descripcion: `En la fase de prueba podés adjuntar hasta ${maxDocs} documento(s) adicional(es). Contactanos si necesitás sumar más material.`,
      };
    case 'nueva_audiencia':
      return {
        titulo: 'Usaste tu audiencia de prueba',
        descripcion:
          'Ya consumiste la audiencia gratuita de tu cuenta en esta fase de prueba. Escribinos si querés probar otra causa o dejarnos tu devolución.',
      };
    default:
      return {
        titulo: 'Límite de la fase de prueba',
        descripcion:
          'Alcanzaste un límite del modo prueba. Estamos evaluando la herramienta con casos reales: escribinos para continuar o enviarnos sugerencias.',
      };
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: AudienciaCopilotUpgradeReason;
  limits?: AudienciaCopilotLimits | null;
};

export function AudienciaCopilotUpgradeDialog({ open, onOpenChange, reason, limits }: Props) {
  const { titulo, descripcion } = mensajeLimite(reason, limits);

  const mailSubject = encodeURIComponent('Copiloto de Audiencias — sugerencias o continuar prueba');
  const mailBody = encodeURIComponent(
    'Hola LegalMev,\n\nQuiero comentar sobre el Copiloto de Audiencias:\n\n'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left pr-6">
            <Scale className="h-5 w-5 shrink-0 text-primary" />
            {titulo}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-muted-foreground pt-1">
              <p className="leading-relaxed text-foreground">{descripcion}</p>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="font-semibold text-foreground">Fase de prueba</p>
                <p className="text-sm leading-relaxed">
                  Nos sirve tu devolución: qué te funcionó, qué mejorarías o errores que detectaste.
                  Con casos reales vamos afinando la herramienta.
                </p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" asChild>
            <a href={`mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`}>
              Escribinos a {CONTACT_EMAIL}
            </a>
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Seguir con lo cargado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
