import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { assertNotificasIntegrationAuth } from "@/lib/notificas-integration";
import { normalizeMembers, type ColegioMember } from "@/lib/colegio-members";

/**
 * GET /api/integrations/notificas/colegios/[colegioId]/members
 * Nómina del colegio para el panel admin de Notificas.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ colegioId: string }> },
) {
  const denied = assertNotificasIntegrationAuth(request);
  if (denied) return denied;

  const { colegioId } = await ctx.params;
  if (!colegioId?.trim()) {
    return NextResponse.json({ ok: false, error: "colegioId requerido" }, { status: 400 });
  }

  try {
    const snap = await getAdminDb().collection("colegios").doc(colegioId.trim()).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Colegio no encontrado" }, { status: 404 });
    }
    const data = snap.data() ?? {};
    const members = normalizeMembers((data.members ?? []) as ColegioMember[]);
    return NextResponse.json({
      ok: true,
      colegioId: snap.id,
      colegioName: String(data.name ?? "").trim() || snap.id,
      convenioActivo: data.convenioActivo === true,
      members: members.map((m) => ({
        email: m.email,
        name: m.name,
        estado: m.estado ?? "activo",
      })),
    });
  } catch (err) {
    console.error("[integrations/notificas/colegios/members]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
