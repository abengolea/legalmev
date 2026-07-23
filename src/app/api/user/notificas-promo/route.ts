import { NextRequest, NextResponse } from "next/server";
import { getAuth, getAdminDb } from "@/lib/firebase-admin";
import { findColegioMemberByEmail } from "@/lib/notificas-integration";
import { buildNotificasLoginUrl } from "@/lib/notificas-public-url";

/** Campaña actual: dismiss previo (colegio-only) no bloquea el 20%/50% ampliado. */
const DISMISS_FIELD = "notificasPromoCampaignV2Dismissed";
const DISMISS_AT_FIELD = "notificasPromoCampaignV2DismissedAt";

function promoPercents() {
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

async function authUid(request: NextRequest): Promise<
  | { ok: true; uid: string; email: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 }) };
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email =
      typeof decoded.email === "string" && decoded.email.trim()
        ? decoded.email.trim().toLowerCase()
        : "";
    return { ok: true, uid: decoded.uid, email };
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 }) };
  }
}

/**
 * GET /api/user/notificas-promo
 * Modal/cartel Notificas: 50% convenio o 20% por estar logueado en LegalMev.
 * El usuario autenticado con perfil activo cuenta como registrado (no depende de query por email).
 */
export async function GET(request: NextRequest) {
  const auth = await authUid(request);
  if (!auth.ok) return auth.response;

  const { uid, email } = auth;
  if (!email) {
    return NextResponse.json({ ok: true, show: false, reason: "sin_email" });
  }

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : undefined;
  if (userData?.[DISMISS_FIELD] === true) {
    return NextResponse.json({ ok: true, show: false, reason: "dismissed" });
  }

  const status = String(userData?.status ?? "activo").trim().toLowerCase();
  const profileOk =
    userSnap.exists && status !== "bloqueado" && status !== "inactivo";

  const { convenioPercent, registeredPercent, freeShipments } = promoPercents();
  const hit = email ? await findColegioMemberByEmail(email) : null;
  const hasConvenio = Boolean(hit?.isMember && hit.convenioActivo);

  const userName =
    (typeof userData?.name === "string" && userData.name.trim()) ||
    hit?.memberName ||
    email.split("@")[0];

  if (hasConvenio && hit) {
    return NextResponse.json({
      ok: true,
      show: true,
      tier: "convenio",
      userName,
      colegioId: hit.colegioId,
      colegioName: hit.colegioName,
      freeShipments,
      discountPercent: convenioPercent,
      notificasLoginUrl: buildNotificasLoginUrl({
        colegioId: hit.colegioId,
        discountPercent: convenioPercent,
        tier: "convenio",
      }),
    });
  }

  // Usuario logueado con perfil = beneficio 20% (sin envíos gratis).
  if (profileOk) {
    return NextResponse.json({
      ok: true,
      show: true,
      tier: "legalmev",
      userName,
      colegioId: null,
      colegioName: null,
      freeShipments: 0,
      discountPercent: registeredPercent,
      notificasLoginUrl: buildNotificasLoginUrl({
        discountPercent: registeredPercent,
        tier: "legalmev",
      }),
    });
  }

  return NextResponse.json({ ok: true, show: false, reason: "sin_perfil" });
}

/**
 * POST /api/user/notificas-promo
 * Body: { dismiss: true } — no volver a mostrar el modal de esta campaña.
 */
export async function POST(request: NextRequest) {
  const auth = await authUid(request);
  if (!auth.ok) return auth.response;

  let body: { dismiss?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  if (body.dismiss !== true) {
    return NextResponse.json({ ok: false, error: "Solo se admite dismiss: true" }, { status: 400 });
  }

  const adminDb = getAdminDb();
  await adminDb.collection("users").doc(auth.uid).set(
    {
      [DISMISS_FIELD]: true,
      [DISMISS_AT_FIELD]: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
