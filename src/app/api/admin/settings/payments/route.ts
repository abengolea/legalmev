import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

const SETTINGS_DOC = 'settings/payments';

/**
 * GET /api/admin/settings/payments
 * Lee la configuración de pagos. Requiere admin.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const docSnap = await adminDb.doc(SETTINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : {};

    return NextResponse.json({
      ok: true,
      settings: {
        stripePublishableKey: data?.stripePublishableKey ?? '',
        premiumPriceId: data?.premiumPriceId ?? '',
        premiumPriceAmount: data?.premiumPriceAmount ?? 0,
        currency: data?.currency ?? 'ARS',
        contactEmail: data?.contactEmail ?? 'contacto@legalmev.com',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * PATCH /api/admin/settings/payments
 * Actualiza la configuración de pagos. Requiere admin.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof body.stripePublishableKey === 'string') update.stripePublishableKey = body.stripePublishableKey;
    if (typeof body.premiumPriceId === 'string') update.premiumPriceId = body.premiumPriceId;
    if (typeof body.premiumPriceAmount === 'number') update.premiumPriceAmount = body.premiumPriceAmount;
    if (typeof body.currency === 'string') update.currency = body.currency;
    if (typeof body.contactEmail === 'string') update.contactEmail = body.contactEmail;

    await adminDb.doc(SETTINGS_DOC).set(update, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
