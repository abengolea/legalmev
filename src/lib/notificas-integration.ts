import { NextRequest } from "next/server";
import { getAdminDb, getAuth } from "@/lib/firebase-admin";
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

export type NotificasDiscountTier = "convenio" | "legalmev";

export type NotificasDiscountLookup = {
  isRegistered: boolean;
  hasConvenio: boolean;
  discountTier: NotificasDiscountTier | null;
  discountPercent: number;
  /** Solo convenio: envíos gratis de prueba (el 20% LegalMev no incluye). */
  freeShipments: number;
  userName?: string;
  colegioId?: string;
  colegioName?: string;
};

function notificasPromoPercents() {
  const convenioRaw = process.env.NOTIFICAS_PROMO_DISCOUNT_PERCENT?.trim();
  const registeredRaw = process.env.NOTIFICAS_PROMO_REGISTERED_DISCOUNT_PERCENT?.trim();
  const freeRaw = process.env.NOTIFICAS_PROMO_FREE_SHIPMENTS?.trim();
  const convenio = convenioRaw ? Number(convenioRaw) : 50;
  const registered = registeredRaw ? Number(registeredRaw) : 20;
  const freeShipments = freeRaw ? Number(freeRaw) : 3;
  const clamp = (n: number, fallback: number) =>
    Number.isFinite(n) && n >= 0 && n <= 100 ? Math.floor(n) : fallback;
  return {
    convenioPercent: clamp(convenio, 50),
    registeredPercent: clamp(registered, 20),
    freeShipments:
      Number.isFinite(freeShipments) && freeShipments >= 0 ? Math.floor(freeShipments) : 3,
  };
}

/**
 * Usuario LegalMev por email (perfil Firestore activo).
 * Fallback: Auth getUserByEmail → doc users/{uid} (cubre emails mal normalizados en Firestore).
 */
export async function findRegisteredUserByEmail(email: string): Promise<{
  uid: string;
  name: string;
  status: string;
} | null> {
  const norm = email.trim().toLowerCase();
  if (!norm || !norm.includes("@")) return null;

  const adminDb = getAdminDb();
  const snap = await adminDb.collection("users").where("email", "==", norm).limit(5).get();

  for (const doc of snap.docs) {
    const data = doc.data() ?? {};
    const status = String(data.status ?? "activo").trim().toLowerCase();
    if (status === "bloqueado" || status === "inactivo") continue;
    const name =
      (typeof data.name === "string" && data.name.trim()) ||
      norm.split("@")[0];
    return { uid: doc.id, name, status: status || "activo" };
  }

  try {
    const authUser = await getAuth().getUserByEmail(norm);
    const userSnap = await adminDb.collection("users").doc(authUser.uid).get();
    if (!userSnap.exists) {
      return {
        uid: authUser.uid,
        name: authUser.displayName?.trim() || norm.split("@")[0],
        status: "activo",
      };
    }
    const data = userSnap.data() ?? {};
    const status = String(data.status ?? "activo").trim().toLowerCase();
    if (status === "bloqueado" || status === "inactivo") return null;
    return {
      uid: authUser.uid,
      name:
        (typeof data.name === "string" && data.name.trim()) ||
        authUser.displayName?.trim() ||
        norm.split("@")[0],
      status: status || "activo",
    };
  } catch {
    return null;
  }
}

/**
 * Descuento Notificas para un email: 50% convenio (prioridad) o 20% registrado LegalMev.
 * El 20% no incluye envíos gratis.
 */
export async function resolveNotificasDiscountForEmail(
  email: string,
): Promise<NotificasDiscountLookup> {
  const norm = email.trim().toLowerCase();
  const { convenioPercent, registeredPercent, freeShipments } = notificasPromoPercents();
  const empty: NotificasDiscountLookup = {
    isRegistered: false,
    hasConvenio: false,
    discountTier: null,
    discountPercent: 0,
    freeShipments: 0,
  };
  if (!norm || !norm.includes("@")) return empty;

  const [hit, user] = await Promise.all([
    findColegioMemberByEmail(norm),
    findRegisteredUserByEmail(norm),
  ]);
  const hasConvenio = Boolean(hit?.isMember && hit.convenioActivo);
  if (hasConvenio && hit) {
    return {
      isRegistered: Boolean(user),
      hasConvenio: true,
      discountTier: "convenio",
      discountPercent: convenioPercent,
      freeShipments,
      userName: user?.name || hit.memberName || undefined,
      colegioId: hit.colegioId,
      colegioName: hit.colegioName,
    };
  }

  if (!user) return empty;

  return {
    isRegistered: true,
    hasConvenio: false,
    discountTier: "legalmev",
    discountPercent: registeredPercent,
    freeShipments: 0,
    userName: user.name,
  };
}

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
