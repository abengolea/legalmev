"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  fetchNotificasPromoInfo,
  type NotificasPromoInfo,
} from "@/lib/notificas-promo-client";

/**
 * Invitación persistente a Notificas en el panel (complementa el modal y el ítem del sidebar).
 */
export function NotificasPromoDashboardCard() {
  const [promo, setPromo] = useState<NotificasPromoInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setPromo(null);
        return;
      }
      try {
        const info = await fetchNotificasPromoInfo();
        if (!cancelled) setPromo(info);
      } catch {
        if (!cancelled) setPromo(null);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Fallback visible aunque la API falle: siempre invitamos a conocer Notificas.
  const pct = promo?.discountPercent ?? 20;
  const isConvenio = promo?.tier === "convenio";
  const loginUrl =
    promo?.notificasLoginUrl ?? "https://notificas.com.ar/login?ref=legalmev&tier=legalmev&discount=20";

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Megaphone className="h-5 w-5 text-primary" />
          Notificas — beneficio LegalMev
        </CardTitle>
        <CardDescription className="space-y-2 text-sm text-foreground/80">
          {isConvenio && promo ? (
            <p>
              Por tu matrícula en <strong>{promo.colegioName ?? "tu colegio"}</strong>:{" "}
              <strong className="text-primary">{pct}% de descuento</strong>
              {promo.freeShipments > 0
                ? ` y ${promo.freeShipments} envío${promo.freeShipments === 1 ? "" : "s"} gratis`
                : ""}{" "}
              en notificaciones digitales certificadas (email y WhatsApp).
            </p>
          ) : (
            <p>
              Por estar registrado en LegalMev:{" "}
              <strong className="text-primary">{pct}% de descuento</strong> en Notificas —
              notificaciones certificadas por email y WhatsApp, con constancia PDF para el
              expediente.
            </p>
          )}
          <p className="text-muted-foreground">
            Entrá con el mismo correo de LegalMev para que el descuento se active solo al comprar
            envíos.
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => window.open(loginUrl, "_blank", "noopener,noreferrer")}
        >
          Aprovechar descuento
          <ExternalLink className="ml-2 h-4 w-4 opacity-70" aria-hidden />
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/notificas">Ver cómo funciona</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
