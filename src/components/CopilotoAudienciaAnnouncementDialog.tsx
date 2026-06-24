'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gavel, Loader2 } from 'lucide-react';
import { CONTACT_EMAIL } from '@/lib/site-contact';

type AnnouncementPayload = {
  show: boolean;
  userName?: string;
  copilotUnlimited?: boolean;
  trialLimit?: number;
  trialRemaining?: number;
  trialUsed?: number;
  tieneConvenioColegio?: boolean;
  colegioName?: string;
};

const SESSION_SHOWN_KEY = 'legalmev-copiloto-announcement-shown';

function mensajePrueba(payload: AnnouncementPayload): string {
  if (payload.copilotUnlimited) {
    return 'Tenés acceso al copiloto para usarlo en todas tus audiencias.';
  }

  const remaining = payload.trialRemaining ?? 0;
  const limit = payload.trialLimit ?? 1;
  const used = payload.trialUsed ?? 0;

  if (remaining <= 0) {
    return used > 0
      ? `Ya usaste ${used === 1 ? 'tu audiencia de prueba' : `las ${used} audiencias de prueba`} incluida${used === 1 ? '' : 's'} en tu cuenta.`
      : 'No tenés audiencias de prueba disponibles en este momento.';
  }

  if (limit === 1 && remaining === 1) {
    return 'Tu cuenta incluye 1 audiencia de prueba gratuita para conocer el copiloto.';
  }

  if (remaining === limit) {
    return `Tenés ${remaining} audiencia${remaining === 1 ? '' : 's'} de prueba disponible${remaining === 1 ? '' : 's'} en tu cuenta.`;
  }

  return `Te quedan ${remaining} de ${limit} audiencia${limit === 1 ? '' : 's'} de prueba.`;
}

export function CopilotoAudienciaAnnouncementDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<AnnouncementPayload | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user/copiloto-audiencia-announcement', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.show) {
        setPayload(null);
        return;
      }

      if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') {
        setPayload(null);
        return;
      }

      setPayload({
        show: true,
        userName: typeof data.userName === 'string' ? data.userName : undefined,
        copilotUnlimited: !!data.copilotUnlimited,
        trialLimit: typeof data.trialLimit === 'number' ? data.trialLimit : 1,
        trialRemaining: typeof data.trialRemaining === 'number' ? data.trialRemaining : 1,
        trialUsed: typeof data.trialUsed === 'number' ? data.trialUsed : 0,
        tieneConvenioColegio: !!data.tieneConvenioColegio,
        colegioName: typeof data.colegioName === 'string' ? data.colegioName : undefined,
      });
      setOpen(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
      }
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) void fetchAnnouncement();
      else {
        setLoading(false);
        setOpen(false);
      }
    });
    return () => unsub();
  }, [fetchAnnouncement]);

  const dismissPermanent = async () => {
    setDismissing(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        await fetch('/api/user/copiloto-audiencia-announcement', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dismiss: true }),
        });
      }
    } catch {
      /* cerrar igual */
    } finally {
      setDismissing(false);
      setOpen(false);
    }
  };

  if (loading || !payload?.show) {
    return null;
  }

  const firstName = (payload.userName || '').split(/\s+/)[0] || 'colega';
  const tienePruebaDisponible =
    payload.copilotUnlimited || (payload.trialRemaining ?? 0) > 0;
  const textoPrueba = mensajePrueba(payload);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-base leading-snug pr-6">
            <Gavel className="h-5 w-5 shrink-0 text-primary" />
            Nuevo en LegalMev: Copiloto de Audiencias
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-muted-foreground pt-2">
              <p className="text-foreground leading-relaxed">
                Hola, <strong>{firstName}</strong>. LegalMev incorpora un asistente con IA para
                preparar y conducir audiencias usando el expediente que exportás desde MEV/PJN.
              </p>

              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="font-semibold text-foreground">¿Qué hace?</p>
                <ul className="space-y-1.5 text-sm leading-relaxed list-disc pl-4">
                  <li>Analiza el expediente y resume partes, hechos, prueba y testigos.</li>
                  <li>Sugiere preguntas y repreguntas según el rol que representás.</li>
                  <li>Marca contradicciones, admisiones y evasivas mientras declara el testigo.</li>
                  <li>Genera un borrador de alegatos de cierre con todo lo dicho en la audiencia.</li>
                </ul>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="font-semibold text-foreground">Cómo empezar</p>
                <ol className="space-y-1.5 text-sm leading-relaxed list-decimal pl-4">
                  <li>Subí el PDF exportado con LegalMev (con texto seleccionable).</li>
                  <li>Indicá si representás al actor, demandado, defensa o fiscalía.</li>
                  <li>Anotá cada pregunta y respuesta durante la audiencia.</li>
                  <li>Al cerrar los testimonios, pedí el borrador de alegatos.</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                  La sesión queda guardada en la nube: podés retomarla cuando quieras.
                </p>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Tu cuenta</p>
                  <p className="mt-1 text-sm leading-relaxed">{textoPrueba}</p>
                </div>
                <div className="border-t border-primary/20 pt-3 space-y-2">
                  <p className="font-semibold text-foreground">Fase de prueba</p>
                  <p className="text-sm leading-relaxed">
                    El copiloto está en etapa de prueba con usuarios reales. Nos sirve mucho tu
                    devolución: qué te funcionó, qué mejorarías o si detectaste errores.
                  </p>
                  {!payload.copilotUnlimited && (payload.trialRemaining ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      La prueba incluye límites de declarantes y preguntas. Anotá solo los
                      intercambios importantes para aprovechar mejor la herramienta.
                    </p>
                  )}
                  <p className="text-sm leading-relaxed">
                    Sugerencias:{' '}
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Copiloto de Audiencias — sugerencias')}`}
                      className="text-primary underline font-medium"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {tienePruebaDisponible && (
            <Button type="button" className="w-full" asChild>
              <Link href="/dashboard/copiloto-audiencias" onClick={() => setOpen(false)}>
                Ir al Copiloto de Audiencias
              </Link>
            </Button>
          )}
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Ahora no
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1 text-muted-foreground"
              disabled={dismissing}
              onClick={() => void dismissPermanent()}
            >
              {dismissing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'No volver a mostrar'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
