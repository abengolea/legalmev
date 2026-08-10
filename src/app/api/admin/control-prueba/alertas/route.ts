import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeControlPrueba } from '@/lib/control-prueba-api-auth';
import { CONTROL_PRUEBA_COLLECTION, normalizeItems } from '@/lib/control-prueba';
import { listarAlertasItems, resumirAlertas } from '@/lib/control-prueba-alertas';

/** GET /api/admin/control-prueba/alertas — resumen global para badge de navegación */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const [ownedSnap, sharedSnap] = await Promise.all([
      adminDb.collection(CONTROL_PRUEBA_COLLECTION).where('createdBy', '==', auth.uid).limit(100).get(),
      adminDb
        .collection(CONTROL_PRUEBA_COLLECTION)
        .where('sharedWithUids', 'array-contains', auth.uid)
        .limit(100)
        .get(),
    ]);
    const seen = new Set<string>();
    const docs = [...ownedSnap.docs, ...sharedSnap.docs].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    let totalRiesgo = 0;
    let rojo = 0;
    let amarillo = 0;
    const expedientesConRiesgo: { id: string; caratula: string; riesgo: number }[] = [];

    for (const doc of docs) {
      const data = doc.data();
      const items = normalizeItems(data.items);
      const alertas = listarAlertasItems(items);
      const res = resumirAlertas(alertas);
      if (res.totalRiesgo > 0) {
        totalRiesgo += res.totalRiesgo;
        rojo += res.rojo;
        amarillo += res.amarillo;
        expedientesConRiesgo.push({
          id: doc.id,
          caratula: String(data.caratula ?? 'Sin carátula'),
          riesgo: res.totalRiesgo,
        });
      }
    }

    expedientesConRiesgo.sort((a, b) => b.riesgo - a.riesgo);

    return NextResponse.json({
      ok: true,
      totalRiesgo,
      rojo,
      amarillo,
      expedientesConRiesgo: expedientesConRiesgo.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}
