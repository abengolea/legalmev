import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { PDF_DOWNLOADS_UNLIMITED } from '@/lib/pdf-downloads-policy';

const SETTINGS_DOC = 'settings/payments';

/**
 * GET /api/settings/quota
 * Retorna las cuotas de descargas (free y premium) para uso público en dashboard/landing.
 * No requiere autenticación.
 */
export async function GET() {
  try {
    if (PDF_DOWNLOADS_UNLIMITED) {
      return NextResponse.json({
        ok: true,
        unlimited: true,
        freeQuota: null,
        premiumQuotaPerMonth: null,
      });
    }

    const adminDb = getAdminDb();
    const docSnap = await adminDb.doc(SETTINGS_DOC).get();
    const data = docSnap.exists ? docSnap.data() : {};

    const freeQuota = 5;
    const premiumQuotaPerMonth =
      typeof data?.premiumQuotaPerMonth === 'number' && data.premiumQuotaPerMonth > 0
        ? data.premiumQuotaPerMonth
        : 100;

    return NextResponse.json({
      ok: true,
      unlimited: false,
      freeQuota,
      premiumQuotaPerMonth,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
