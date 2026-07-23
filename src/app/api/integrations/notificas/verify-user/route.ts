import { NextRequest, NextResponse } from "next/server";
import {
  assertNotificasIntegrationAuth,
  resolveNotificasDiscountForEmail,
} from "@/lib/notificas-integration";

/**
 * POST /api/integrations/notificas/verify-user
 * Verifica si un email es usuario LegalMev y qué descuento Notificas le corresponde.
 *
 * Body: { email: string }
 * Auth: Authorization: Bearer NOTIFICAS_LEGALMEV_SHARED_SECRET
 *
 * Prioridad: convenio colegio (50% + envíos gratis) > registrado LegalMev (20%, sin envíos gratis).
 */
export async function POST(request: NextRequest) {
  const denied = assertNotificasIntegrationAuth(request);
  if (denied) return denied;

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "email inválido" }, { status: 400 });
  }

  try {
    const resolved = await resolveNotificasDiscountForEmail(email);
    return NextResponse.json({
      ok: true,
      isRegistered: resolved.isRegistered,
      hasConvenio: resolved.hasConvenio,
      discountTier: resolved.discountTier,
      discountPercent: resolved.discountPercent,
      freeShipments: resolved.freeShipments,
      userName: resolved.userName ?? null,
      colegioId: resolved.colegioId ?? null,
      colegioName: resolved.colegioName ?? null,
    });
  } catch (err) {
    console.error("[integrations/notificas/verify-user]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
