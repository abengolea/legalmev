import { NextRequest, NextResponse } from "next/server";
import {
  assertNotificasIntegrationAuth,
  findColegioMemberByEmail,
} from "@/lib/notificas-integration";

/**
 * POST /api/integrations/notificas/verify-member
 * Verifica si un email está en la nómina de un colegio (LegalMev = fuente de verdad).
 *
 * Body: { email: string, colegioId?: string }
 * Auth: Authorization: Bearer NOTIFICAS_LEGALMEV_SHARED_SECRET
 */
export async function POST(request: NextRequest) {
  const denied = assertNotificasIntegrationAuth(request);
  if (denied) return denied;

  let body: { email?: unknown; colegioId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const colegioId = typeof body.colegioId === "string" ? body.colegioId.trim() : undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "email inválido" }, { status: 400 });
  }

  try {
    const hit = await findColegioMemberByEmail(email, colegioId ? { colegioId } : undefined);

    if (!hit) {
      return NextResponse.json({
        ok: true,
        isMember: false,
        onList: false,
        convenioActivo: false,
      });
    }

    const onList = true;
    const isMember = hit.isMember && hit.convenioActivo;

    return NextResponse.json({
      ok: true,
      isMember,
      onList,
      colegioId: hit.colegioId,
      colegioName: hit.colegioName,
      memberName: hit.memberName,
      estado: hit.estado,
      convenioActivo: hit.convenioActivo,
    });
  } catch (err) {
    console.error("[integrations/notificas/verify-member]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
