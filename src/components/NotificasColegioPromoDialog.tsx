"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

type PromoTier = "convenio" | "legalmev";

type PromoPayload = {
  show: boolean;
  tier: PromoTier;
  userName?: string;
  colegioId?: string;
  colegioName?: string;
  freeShipments?: number;
  discountPercent?: number;
  notificasLoginUrl?: string;
};

const SESSION_SHOWN_KEY = "legalmev-notificas-promo-v2-shown";

export function NotificasColegioPromoDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PromoPayload | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const fetchPromo = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const meRes = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meJson = await meRes.json().catch(() => ({}));
      if (meJson?.ok && meJson.user?.isColegioAdmin && !meJson.user?.isPlatformAdmin) {
        setPayload(null);
        return;
      }

      const res = await fetch("/api/user/notificas-promo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.show) {
        setPayload(null);
        return;
      }

      const tier: PromoTier = data.tier === "legalmev" ? "legalmev" : "convenio";
      const colegioId = typeof data.colegioId === "string" ? data.colegioId : "";
      const key =
        tier === "convenio" && colegioId
          ? `${SESSION_SHOWN_KEY}:convenio:${colegioId}`
          : `${SESSION_SHOWN_KEY}:${tier}`;
      if (typeof window !== "undefined" && sessionStorage.getItem(key) === "1") {
        setPayload(null);
        return;
      }

      setSessionKey(key);
      setPayload({
        show: true,
        tier,
        userName: typeof data.userName === "string" ? data.userName : undefined,
        colegioId,
        colegioName: typeof data.colegioName === "string" ? data.colegioName : "tu colegio",
        freeShipments: typeof data.freeShipments === "number" ? data.freeShipments : 0,
        discountPercent:
          typeof data.discountPercent === "number"
            ? data.discountPercent
            : tier === "convenio"
              ? 50
              : 20,
        notificasLoginUrl:
          typeof data.notificasLoginUrl === "string" ? data.notificasLoginUrl : undefined,
      });
      setOpen(true);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) void fetchPromo();
      else {
        setLoading(false);
        setOpen(false);
      }
    });
    return () => unsub();
  }, [fetchPromo]);

  const markSessionShown = () => {
    if (typeof window !== "undefined" && sessionKey) {
      sessionStorage.setItem(sessionKey, "1");
    }
  };

  const dismissPermanent = async () => {
    setDismissing(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        await fetch("/api/user/notificas-promo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dismiss: true }),
        });
      }
    } catch {
      /* cerrar igual */
    } finally {
      markSessionShown();
      setDismissing(false);
      setOpen(false);
    }
  };

  const goToNotificas = () => {
    markSessionShown();
    const url = payload?.notificasLoginUrl;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) markSessionShown();
    setOpen(next);
  };

  if (loading || !payload?.show) {
    return null;
  }

  const firstName = (payload.userName || "").split(/\s+/)[0] || "colega";
  const colegioName = payload.colegioName ?? "tu colegio";
  const envios = payload.freeShipments ?? 0;
  const pct = payload.discountPercent ?? (payload.tier === "convenio" ? 50 : 20);
  const isConvenio = payload.tier === "convenio";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto z-[100]">
        <DialogHeader>
          <DialogTitle className="text-left text-base leading-snug pr-6">
            {isConvenio ? (
              <>
                Beneficio exclusivo por tu matrícula en el{" "}
                <span className="text-primary">{colegioName}</span>
              </>
            ) : (
              <>
                Beneficio por estar registrado en{" "}
                <span className="text-primary">LegalMev</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-muted-foreground pt-2">
              <p className="text-foreground leading-relaxed">
                Hola, <strong>{firstName}</strong>.
                <br />
                {isConvenio ? (
                  <>
                    Por formar parte del <strong>{colegioName}</strong>, ahora tenés acceso a un nuevo
                    beneficio con <strong className="text-primary">Notificas</strong>, la plataforma de
                    notificaciones digitales certificadas de <strong>NOTIFICAS SRL</strong>.
                  </>
                ) : (
                  <>
                    Por ser usuario de <strong>LegalMev</strong>, tenés un beneficio en{" "}
                    <strong className="text-primary">Notificas</strong>, la plataforma de
                    notificaciones digitales certificadas de <strong>NOTIFICAS SRL</strong>.
                  </>
                )}
              </p>

              <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                <p className="font-semibold text-foreground">¿Qué es Notificas?</p>
                <ul className="space-y-2 text-sm leading-relaxed">
                  <li>Envío de notificaciones certificadas por email y WhatsApp.</li>
                  <li>Certificación y trazabilidad en blockchain (Red Polygon).</li>
                  <li>Constancia verificable de envío, recepción y lectura.</li>
                  <li>
                    Generación automática de certificado PDF para incorporar a expedientes
                    judiciales o extrajudiciales.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="font-semibold text-foreground">Tu beneficio incluye:</p>
                <ul className="space-y-2 text-sm leading-relaxed">
                  {isConvenio && envios > 0 ? (
                    <li>
                      {envios} envío{envios === 1 ? "" : "s"} gratuitos para probar la plataforma.
                    </li>
                  ) : null}
                  {pct > 0 ? (
                    <li>
                      {pct}% de descuento en envíos
                      {isConvenio ? " adicionales" : ""}.
                    </li>
                  ) : null}
                  <li>Herramienta pensada especialmente para profesionales del derecho.</li>
                </ul>
              </div>

              <p className="text-sm leading-relaxed">
                {isConvenio ? (
                  <>
                    Usá el <strong>mismo correo electrónico</strong> registrado en tu matrícula del{" "}
                    <strong>{colegioName}</strong> para activar automáticamente el beneficio.
                  </>
                ) : (
                  <>
                    Usá el <strong>mismo correo electrónico</strong> con el que estás registrado en{" "}
                    <strong>LegalMev</strong> para activar automáticamente el {pct}% de descuento.
                  </>
                )}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" onClick={goToNotificas}>
            Ingresar a Notificas
            <ExternalLink className="ml-2 h-4 w-4 opacity-70" aria-hidden />
          </Button>
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                markSessionShown();
                setOpen(false);
              }}
            >
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
                "No volver a mostrar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
