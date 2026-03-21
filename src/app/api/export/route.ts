import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminStorage, getStorageBucketName } from '@/lib/firebase-admin';
import { requireAuthWithDevice } from '@/lib/require-auth-device';
import { generateExpedientePDF, generateFilename } from '@/lib/pdf-generator';
import type { ExportRequest, Expediente } from '@/types/expediente';

const PROVEIDO_REGEX = /^https:\/\/mev\.scba\.gov\.ar\/proveido\.asp\?.*pidJuzgado=.*sCodi=.*nPosi=\d+/i;
const PJN_REGEX = /^https:\/\/scw\.pjn\.gov\.ar/i;

const FREE_QUOTA = 5;
const PREMIUM_QUOTA_DEFAULT = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthWithDevice(request);
    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status, headers: corsHeaders }
      );
    }

    const { uid, userData } = authResult;
    const adminDb = getAdminDb();

    const paymentsSnap = await adminDb.doc('settings/payments').get();
    const payments = paymentsSnap.data();
    const globalQuota = (payments?.premiumQuotaPerMonth && payments.premiumQuotaPerMonth > 0)
      ? payments.premiumQuotaPerMonth
      : PREMIUM_QUOTA_DEFAULT;

    let premiumQuota = globalQuota;
    if (userData.premiumSource === 'colegio' && userData.colegioId) {
      const colegioSnap = await adminDb.collection('colegios').doc(userData.colegioId).get();
      const colegioData = colegioSnap.data();
      if (colegioData?.cuotaMensual != null && colegioData.cuotaMensual > 0) {
        premiumQuota = colegioData.cuotaMensual;
      }
    }

    const tier = userData.tier ?? 'free';
    const now = new Date();

    if (tier === 'free') {
      const used = userData.freeDownloadsUsed ?? 0;
      if (used >= FREE_QUOTA) {
        return NextResponse.json(
          { ok: false, error: `Ya usaste tus ${FREE_QUOTA} descargas gratuitas. Contactanos para el plan premium (${premiumQuota}/mes).` },
          { status: 403, headers: corsHeaders }
        );
      }
    } else {
      let used = userData.downloadsThisMonth ?? 0;
      const resetAt = userData.monthlyResetAt ? new Date(userData.monthlyResetAt) : null;
      if (resetAt && now >= resetAt) {
        await adminDb.collection('users').doc(uid).update({
          downloadsThisMonth: 0,
          monthlyResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        used = 0;
      }
      if (used >= premiumQuota) {
        return NextResponse.json(
          { ok: false, error: `Llegaste al límite de ${premiumQuota} expedientes por mes. Se renueva automáticamente.` },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const body = (await request.json()) as ExportRequest;
    const {
      expedienteUrl,
      pageTitle,
      actuaciones,
      caratula = '',
      nroExpediente = '',
      juzgado = '',
    } = body;

    if (!expedienteUrl?.trim()) {
      return NextResponse.json({ ok: false, error: 'Falta expedienteUrl' }, { status: 400, headers: corsHeaders });
    }

    if (!Array.isArray(actuaciones) || actuaciones.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No se recibieron actuaciones. La extensión debe enviar el contenido de cada proveído.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const expedienteEsPJN = PJN_REGEX.test(expedienteUrl || '');
    const seen = new Set<string>();
    const actuacionesFiltradas = actuaciones.filter((item) => {
      if (typeof item !== 'object') return false;
      const url = String(item?.url || '').trim();
      const tieneContenido = !!(item?.contenido || item?.content || item?.titulo || item?.title || item?.tipo);
      const esMEV = url && PROVEIDO_REGEX.test(url);
      const esPJN = (url && PJN_REGEX.test(url)) || (expedienteEsPJN && (url || true));
      if (!esMEV && !(esPJN && tieneContenido)) return false;
      const key = (url || expedienteUrl) + '|' + (item?.numero ?? '') + '|' + (item?.titulo || item?.title || item?.tipo || '').slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (actuacionesFiltradas.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No quedaron actuaciones válidas para exportar. Verificá que estés en la página del expediente (expediente.seam) con la pestaña Actuaciones visible.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const expediente: Expediente = {
      numero: nroExpediente || undefined,
      caratula: caratula || undefined,
      juzgado: juzgado || undefined,
      url: expedienteUrl,
      pageTitle,
    };

    const pdfBytes = await generateExpedientePDF({
      expediente,
      actuaciones: actuacionesFiltradas,
    });

    const filename = generateFilename(expediente, actuacionesFiltradas);

    const adminStorage = getAdminStorage();
    const bucketName = getStorageBucketName();

    // Debug: ver qué llega al runtime en App Hosting (revisar logs en Cloud Run)
    console.log('[DEBUG] APP_STORAGE_BUCKET:', process.env.APP_STORAGE_BUCKET);
    console.log('[DEBUG] FIREBASE_CONFIG:', process.env.FIREBASE_CONFIG ? '(presente)' : '(vacío)');
    console.log('[DEBUG] bucket name used:', bucketName);

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(`exports/${filename}`);
    await file.save(Buffer.from(pdfBytes), {
      metadata: { contentType: 'application/pdf' },
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });

    const docData: Record<string, unknown> = {
      userId: uid,
      expedienteNumero: (expediente.numero || expedienteUrl.match(/nidCausa=(\d+)/i)?.[1]) ?? '',
      cantidadActuaciones: actuacionesFiltradas.length,
      filename,
      url,
      creadoEn: new Date().toISOString(),
    };
    if (expediente.caratula) docData.caratula = expediente.caratula;
    if (expediente.juzgado) docData.juzgado = expediente.juzgado;
    await adminDb.collection('exportaciones').add(docData);

    const userRef = adminDb.collection('users').doc(uid);
    if (tier === 'free') {
      const used = userData.freeDownloadsUsed ?? 0;
      await userRef.update({ freeDownloadsUsed: used + 1 });
    } else {
      const resetAt = userData.monthlyResetAt ? new Date(userData.monthlyResetAt) : null;
      let monthUsed = userData.downloadsThisMonth ?? 0;
      let newResetAt = userData.monthlyResetAt;
      if (resetAt && now >= resetAt) {
        monthUsed = 0;
        newResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      await userRef.update({
        downloadsThisMonth: monthUsed + 1,
        monthlyResetAt: newResetAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return NextResponse.json({ ok: true, url, filename }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generando PDF:', error);
    const msg = error instanceof Error ? error.message : 'Error generando el PDF';
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}
