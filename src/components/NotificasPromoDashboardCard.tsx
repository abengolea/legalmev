"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Megaphone } from "lucide-react";

type PromoCardState = {
  tier: "convenio" | "legalmev";
  discountPercent: number;
  freeShipments: number;
  colegioName?: string;
  notificasLoginUrl: string;
};

/**
 * Invitación persistente a Notificas en el panel (complementa el modal).
 */
export function NotificasPromoDashboardCard() {
  const [promo, setPromo] = useState<PromoCardState | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setPromo(null);
        return;
      }
      try {
        const token = await user.getIdToken();
        const meRes = await fetch("/api/user/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meJson = await meRes.json().catch(() => ({}));
        if (meJson?.ok && meJson.user?.isColegioAdmin && !meJson.user?.isPlatformAdmin) {
          if (!cancelled) setPromo(null);
          return;
        }

        const res = await fetch("/api/user/notificas-promo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.show || typeof data.notificasLoginUrl !== "string") {
          setPromo(null);
          return;
        }
        setPromo({
          tier: data.tier === "convenio" ? "convenio" : "legalmev",
          discountPercent:
            typeof data.discountPercent === "number"
              ? data.discountPercent
              : data.tier === "convenio"
                ? 50
                : 20,
          freeShipments: typeof data.freeShipments === "number" ? data.freeShipments : 0,
          colegioName: typeof data.colegioName === "string" ? data.colegioName : undefined,
          notificasLoginUrl: data.notificasLoginUrl,
        });
      } catch {
        if (!cancelled) setPromo(null);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (hidden || !promo) return null;

  const isConvenio = promo.tier === "convenio";
  const pct = promo.discountPercent;

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Probá Notificas
        </CardTitle>
        <CardDescription className="text-sm text-foreground/80 space-y-1">
          {isConvenio ? (
            <span>
              Por tu matrícula en <strong>{promo.colegioName ?? "tu colegio"}</strong>:{" "}
              <strong className="text-primary">{pct}% de descuento</strong>
              {promo.freeShipments > 0
                ? ` y ${promo.freeShipments} envío${promo.freeShipments === 1 ? "" : "s"} gratis`
                : ""}{" "}
              en notificaciones digitales certificadas.
            </span>
          ) : (
            <span>
              Por estar registrado en LegalMev:{" "}
              <strong className="text-primary">{pct}% de descuento</strong> en Notificas
              (notificaciones certificadas por email y WhatsApp).
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => window.open(promo.notificasLoginUrl, "_blank", "noopener,noreferrer")}
        >
          Ir a Notificas
          <ExternalLink className="ml-2 h-4 w-4 opacity-70" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setHidden(true)}>
          Ocultar
        </Button>
      </CardContent>
    </Card>
  );
}
