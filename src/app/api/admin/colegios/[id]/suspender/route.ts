import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { sendConvenioSuspendedEmail } from '@/lib/payment-notifications';
import { PDF_DOWNLOADS_UNLIMITED, lifetimePremiumUserFields } from '@/lib/pdf-downloads-policy';

/** Verifica superadmin de plataforma (no responsables de colegio). */
async function requireAdmin(request: NextRequest) {
  const auth = await requirePlatformAdmin(request);
  if (auth instanceof NextResponse) {
    const status = auth.status;
    const body = await auth.json();
    return { error: (body as { error?: string }).error ?? 'Solo administradores', status } as const;
  }
  return { uid: auth.uid, adminDb: getAdminDb() };
}

/**
 * POST /api/admin/colegios/[id]/suspender
 * Suspende el convenio: pasa convenioActivo a false y quita el vínculo de colegio.
 * Con PDFs ilimitados, los usuarios conservan premium lifetime.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const { id: colegioId } = await params;
    const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
    if (!colegioSnap.exists) return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });

    await adminDb.collection('colegios').doc(colegioId).update({
      convenioActivo: false,
      updatedAt: new Date().toISOString(),
    });

    const colegioData = colegioSnap.data();
    const colegioName = (colegioData?.name as string) || 'tu Colegio';

    const usersSnap = await adminDb.collection('users').where('colegioId', '==', colegioId).get();
    let suspendidos = 0;
    const batch = adminDb.batch();
    const emailsToNotify: { email: string }[] = [];
    for (const doc of usersSnap.docs) {
      const email = (doc.data()?.email as string) || '';
      if (email) emailsToNotify.push({ email });
      batch.update(doc.ref, {
        ...(PDF_DOWNLOADS_UNLIMITED
          ? {
              ...lifetimePremiumUserFields('lifetime'),
              colegioId: null,
              colegioName: null,
              colegioSuspended: true,
            }
          : {
              tier: 'free',
              colegioId: null,
              premiumSource: null,
              colegioName: null,
            }),
        updatedAt: new Date().toISOString(),
      });
      suspendidos++;
    }
    await batch.commit();

    for (const { email } of emailsToNotify) {
      try {
        await sendConvenioSuspendedEmail({ to: email, colegioName });
      } catch (e) {
        console.warn('[suspender] No se pudo enviar email a', email, e);
      }
    }

    return NextResponse.json({
      ok: true,
      suspendidos,
      message: PDF_DOWNLOADS_UNLIMITED
        ? `Convenio suspendido. ${suspendidos} usuarios desvinculados (conservan PDFs ilimitados).`
        : `Convenio suspendido. ${suspendidos} usuarios pasaron a plan gratuito.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
