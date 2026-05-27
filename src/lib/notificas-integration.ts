import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizeMembers, type ColegioMember } from "@/lib/colegio-members";

export function notificasIntegrationSecret(): string | undefined {
  const raw =
    process.env.NOTIFICAS_LEGALMEV_SHARED_SECRET?.trim() ||
    process.env.LEGALMEV_NOTIFICAS_SHARED_SECRET?.trim();
  return raw || undefined;
}

/** Valida Authorization: Bearer <secret> en integraciones server-to-server con Notificas. */
export function assertNotificasIntegrationAuth(request: NextRequest): Response | null {
  const expected = notificasIntegrationSecret();
  if (!expected) {
    return Response.json(
      {
        ok: false,
        error:
          "Integración Notificas no configurada: falta NOTIFICAS_LEGALMEV_SHARED_SECRET en el servidor.",
      },
      { status: 503 },
    );
  }

  const auth = request.headers.get("Authorization")?.trim() ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export type LegalMevMemberLookup = {
  isMember: boolean;
  colegioId: string;
  colegioName: string;
  memberName: string;
  estado: "activo" | "suspendido";
  convenioActivo: boolean;
};

/**
 * Busca un email en la nómina de un colegio (o en todos los convenios activos si no se pasa colegioId).
 * Solo lectura — no modifica usuarios ni premium.
 */
export async function findColegioMemberByEmail(
  email: string,
  options?: { colegioId?: string },
): Promise<LegalMevMemberLookup | null> {
  const norm = email.trim().toLowerCase();
  if (!norm || !norm.includes("@")) return null;

  const adminDb = getAdminDb();
  const colegioIdFilter = options?.colegioId?.trim();

  if (colegioIdFilter) {
    const snap = await adminDb.collection("colegios").doc(colegioIdFilter).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    const members = normalizeMembers((data.members ?? []) as ColegioMember[]);
    const found = members.find((m) => m.email === norm);
    if (!found) return null;
    return {
      isMember: found.estado !== "suspendido",
      colegioId: snap.id,
      colegioName: String(data.name ?? "").trim() || "Colegio",
      memberName: found.name,
      estado: found.estado ?? "activo",
      convenioActivo: data.convenioActivo === true,
    };
  }

  const colegiosSnap = await adminDb.collection("colegios").where("convenioActivo", "==", true).get();
  for (const doc of colegiosSnap.docs) {
    const data = doc.data();
    const members = normalizeMembers((data.members ?? []) as ColegioMember[]);
    const found = members.find((m) => m.email === norm);
    if (found && found.estado !== "suspendido") {
      return {
        isMember: true,
        colegioId: doc.id,
        colegioName: String(data.name ?? "").trim() || "Colegio",
        memberName: found.name,
        estado: "activo",
        convenioActivo: true,
      };
    }
  }

  return null;
}

export type LegalMevColegioSummary = {
  id: string;
  name: string;
  convenioActivo: boolean;
  memberCount: number;
};

/** Lista colegios para que Notificas vincule descuentos (admin). */
export async function listColegiosForNotificas(): Promise<LegalMevColegioSummary[]> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("colegios").get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      const members = normalizeMembers((data.members ?? []) as ColegioMember[]);
      const activos = members.filter((m) => m.estado !== "suspendido").length;
      return {
        id: doc.id,
        name: String(data.name ?? "").trim() || doc.id,
        convenioActivo: data.convenioActivo === true,
        memberCount: activos,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
