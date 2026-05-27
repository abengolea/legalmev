import { NextRequest, NextResponse } from "next/server";
import { getAuth, getAdminDb } from "@/lib/firebase-admin";
import { findColegioMemberByEmail } from "@/lib/notificas-integration";
import { buildNotificasLoginUrl } from "@/lib/notificas-public-url";

function promoDefaults() {
  const freeRaw = process.env.NOTIFICAS_PROMO_FREE_SHIPMENTS?.trim();
  const discRaw = process.env.NOTIFICAS_PROMO_DISCOUNT_PERCENT?.trim();
  const freeShipments = freeRaw ? Number(freeRaw) : 3;
  const discountPercent = discRaw ? Number(discRaw) : 50;
  return {
    freeShipments:
      Number.isFinite(freeShipments) && freeShipments >= 0 ? Math.floor(freeShipments) : 3,
    discountPercent:
      Number.isFinite(discountPercent) && discountPercent >= 0 && discountPercent <= 100
        ? Math.floor(discountPercent)
        : 50,
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
 * Indica si mostrar el modal de Notificas (matriculado en colegio con convenio activo).
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
  if (userData?.notificasPromoDismissed === true) {
    return NextResponse.json({ ok: true, show: false, reason: "dismissed" });
  }

  const hit = await findColegioMemberByEmail(email);
  if (!hit || !hit.isMember || !hit.convenioActivo) {
    return NextResponse.json({ ok: true, show: false, reason: "sin_convenio" });
  }

  const { freeShipments, discountPercent } = promoDefaults();
  const userName =
    (typeof userData?.name === "string" && userData.name.trim()) ||
    hit.memberName ||
    email.split("@")[0];

  return NextResponse.json({
    ok: true,
    show: true,
    userName,
    colegioId: hit.colegioId,
    colegioName: hit.colegioName,
    freeShipments,
    discountPercent,
    notificasLoginUrl: buildNotificasLoginUrl(hit.colegioId),
  });
}

/**
 * POST /api/user/notificas-promo
 * Body: { dismiss: true } — no volver a mostrar el modal.
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
      notificasPromoDismissed: true,
      notificasPromoDismissedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
