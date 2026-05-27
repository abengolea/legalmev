import { NextRequest, NextResponse } from "next/server";
import {
  assertNotificasIntegrationAuth,
  listColegiosForNotificas,
} from "@/lib/notificas-integration";

/**
 * GET /api/integrations/notificas/colegios
 * Lista colegios con convenio (para vincular en el admin de Notificas).
 */
export async function GET(request: NextRequest) {
  const denied = assertNotificasIntegrationAuth(request);
  if (denied) return denied;

  try {
    const colegios = await listColegiosForNotificas();
    return NextResponse.json({ ok: true, colegios });
  } catch (err) {
    console.error("[integrations/notificas/colegios]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
