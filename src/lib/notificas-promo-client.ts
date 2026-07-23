"use client";

import { auth } from "@/lib/firebase";

export type NotificasPromoInfo = {
  tier: "convenio" | "legalmev";
  discountPercent: number;
  freeShipments: number;
  colegioName?: string;
  colegioId?: string;
  userName?: string;
  notificasLoginUrl: string;
};

/**
 * Carga el beneficio Notificas del usuario autenticado.
 * null = no mostrar (responsable colegio-only, dismiss, sin perfil, etc.).
 */
export async function fetchNotificasPromoInfo(): Promise<NotificasPromoInfo | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const token = await user.getIdToken();
  const meRes = await fetch("/api/user/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meJson = await meRes.json().catch(() => ({}));
  if (meJson?.ok && meJson.user?.isColegioAdmin && !meJson.user?.isPlatformAdmin) {
    return null;
  }

  const res = await fetch("/api/user/notificas-promo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  // `show` controla solo el modal; panel/sidebar usan los datos aunque esté dismissed.
  if (!res.ok || !data.tier || typeof data.notificasLoginUrl !== "string") {
    return null;
  }
  if (data.discountPercent == null && data.tier !== "convenio" && data.tier !== "legalmev") {
    return null;
  }

  return {
    tier: data.tier === "convenio" ? "convenio" : "legalmev",
    discountPercent:
      typeof data.discountPercent === "number"
        ? data.discountPercent
        : data.tier === "convenio"
          ? 50
          : 20,
    freeShipments: typeof data.freeShipments === "number" ? data.freeShipments : 0,
    colegioName: typeof data.colegioName === "string" ? data.colegioName : undefined,
    colegioId: typeof data.colegioId === "string" ? data.colegioId : undefined,
    userName: typeof data.userName === "string" ? data.userName : undefined,
    notificasLoginUrl: data.notificasLoginUrl,
  };
}
