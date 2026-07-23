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
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Mail, MessageCircle, ShieldCheck, FileText } from "lucide-react";
import {
  fetchNotificasPromoInfo,
  type NotificasPromoInfo,
} from "@/lib/notificas-promo-client";

export default function NotificasPromoPage() {
  const [promo, setPromo] = useState<NotificasPromoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        if (!cancelled) {
          setPromo(null);
          setLoading(false);
        }
        return;
      }
      try {
        const info = await fetchNotificasPromoInfo();
        if (!cancelled) setPromo(info);
      } catch {
        if (!cancelled) setPromo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pct = promo?.discountPercent ?? 20;
  const isConvenio = promo?.tier === "convenio";
  const loginUrl =
    promo?.notificasLoginUrl ?? "https://notificas.com.ar/login?ref=legalmev";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold">Notificas</h1>
        <p className="mt-1 text-muted-foreground">
          Notificaciones digitales certificadas, pensadas para el ejercicio profesional.
        </p>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">Tu beneficio LegalMev</CardTitle>
            {promo ? (
              <Badge variant="secondary" className="bg-primary/15 text-primary">
                {isConvenio ? `${pct}% colegio` : `${pct}% registrado`}
              </Badge>
            ) : null}
          </div>
          <CardDescription className="text-sm text-foreground/80 space-y-2 pt-1">
            {isConvenio && promo ? (
              <p>
                Por tu matrícula en <strong>{promo.colegioName ?? "tu colegio"}</strong> tenés{" "}
                <strong className="text-primary">{pct}% de descuento</strong>
                {promo.freeShipments > 0
                  ? ` y ${promo.freeShipments} envío${promo.freeShipments === 1 ? "" : "s"} gratis para probar`
                  : ""}
                .
              </p>
            ) : (
              <p>
                Por estar registrado en LegalMev tenés{" "}
                <strong className="text-primary">{pct}% de descuento</strong> en los planes de
                envíos de Notificas.
              </p>
            )}
            <p className="text-muted-foreground">
              Usá el <strong>mismo correo</strong> que en LegalMev
              {isConvenio ? " / tu matrícula" : ""} al registrarte o iniciar sesión en Notificas.
              El descuento se reconoce automáticamente al comprar envíos.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => window.open(loginUrl, "_blank", "noopener,noreferrer")}
          >
            Aprovechar el descuento en Notificas
            <ExternalLink className="ml-2 h-4 w-4 opacity-70" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>¿Qué es Notificas?</CardTitle>
          <CardDescription>
            Plataforma de NOTIFICAS SRL para comunicaciones fehacientes digitales con respaldo
            probatorio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="space-y-3">
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">Email certificado</strong> — constancia de
                envío, recepción y lectura.
              </span>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">WhatsApp certificado</strong> — misma
                trazabilidad para canales que usa tu cliente.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">Blockchain (Polygon)</strong> — sellado
                criptográfico de los eventos del mensaje.
              </span>
            </li>
            <li className="flex gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">Certificado PDF</strong> — para incorporar a
                expedientes judiciales o extrajudiciales.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo activar el descuento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Entrá a Notificas con el botón de arriba (o desde{" "}
              <a
                href="https://notificas.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                notificas.com.ar
              </a>
              ).
            </li>
            <li>Registrate o iniciá sesión con el mismo email de LegalMev.</li>
            <li>
              En la billetera vas a ver el {pct}% aplicado sobre el precio de lista al comprar
              envíos.
            </li>
          </ol>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(loginUrl, "_blank", "noopener,noreferrer")}
          >
            Ir a notificas.com.ar
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
