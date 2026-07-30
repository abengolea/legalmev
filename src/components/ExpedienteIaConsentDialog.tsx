'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  acceptExpedienteIaConsent,
  hasExpedienteIaConsent,
} from '@/lib/expediente-ia-consent';

export type ExpedienteIaConsentFeature = 'copiloto' | 'control-prueba';

const FEATURE_LABEL: Record<ExpedienteIaConsentFeature, string> = {
  copiloto: 'Copiloto de Audiencias',
  'control-prueba': 'Control de Pruebas',
};

type DialogProps = {
  open: boolean;
  feature: ExpedienteIaConsentFeature;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onAccept: () => void;
  onCancel: () => void;
};

function ExpedienteIaConsentDialogView({
  open,
  feature,
  checked,
  onCheckedChange,
  onAccept,
  onCancel,
}: DialogProps) {
  const label = FEATURE_LABEL[feature];

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Autorización y tratamiento del expediente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>
                Al usar <strong className="text-foreground">{label}</strong>, LegalMev trata
                el contenido del expediente <strong className="text-foreground">por tu
                cuenta</strong> (encargo de tratamiento, art. 25 Ley 25.326). Google Gemini
                actúa como subprestador tecnológico de IA.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  el texto se almacena asociado a tu cuenta mientras mantengas la sesión o el
                  expediente activo;
                </li>
                <li>
                  se envía a Gemini solo para la asistencia que pedís (no para entrenar
                  modelos de LegalMev);
                </li>
                <li>
                  el sistema procura redactar DNI, CUIT, domicilios, matrículas, teléfonos y
                  emails, conservando nombres necesarios.
                </li>
              </ul>
              <p>
                En causas de familia, niñez, salud o materia penal aplicá especial cuidado al
                secreto profesional. Detalle en la{' '}
                <Link
                  href="/landing/politica-privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Política de Privacidad
                </Link>{' '}
                y las{' '}
                <Link
                  href="/landing/bases-y-condiciones"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Bases y Condiciones
                </Link>
                .
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
          <Checkbox
            id="expediente-ia-consent"
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(v === true)}
          />
          <Label
            htmlFor="expediente-ia-consent"
            className="cursor-pointer text-sm font-normal leading-snug"
          >
            Declaro que soy abogado, parte o persona autorizada para tratar esta
            documentación; la uso solo con finalidad profesional o judicial legítima; no
            cargaré material sin autorización; y acepto el tratamiento descrito.
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={!checked} onClick={onAccept}>
            Continuar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Pide aceptación una vez por versión de aviso antes de enviar expediente a servidores/IA.
 */
export function useExpedienteIaConsent(feature: ExpedienteIaConsentFeature) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  const ensureConsent = useCallback((then: () => void) => {
    if (hasExpedienteIaConsent()) {
      then();
      return;
    }
    pendingRef.current = then;
    setChecked(false);
    setOpen(true);
  }, []);

  const onAccept = useCallback(() => {
    acceptExpedienteIaConsent();
    setOpen(false);
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  }, []);

  const onCancel = useCallback(() => {
    pendingRef.current = null;
    setOpen(false);
    setChecked(false);
  }, []);

  const consentDialog = (
    <ExpedienteIaConsentDialogView
      open={open}
      feature={feature}
      checked={checked}
      onCheckedChange={setChecked}
      onAccept={onAccept}
      onCancel={onCancel}
    />
  );

  return { ensureConsent, consentDialog };
}
