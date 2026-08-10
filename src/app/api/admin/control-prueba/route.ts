import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeControlPrueba } from '@/lib/control-prueba-api-auth';
import {
  consumeControlPruebaQuota,
  type ControlPruebaTrial,
} from '@/lib/control-prueba-access';
import {
  CONTROL_PRUEBA_COLLECTION,
  detectSistemaFromUrl,
  normalizeItems,
  sanitizeForFirestore,
  serializeControlPruebaDoc,
} from '@/lib/control-prueba';
import { repairSpanishTextEncoding } from '@/lib/text-encoding-repair';
import type { ControlPruebaExpedienteInput } from '@/types/control-prueba';
import { resolveResourceAccess } from '@/lib/resource-sharing';

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return serializeControlPruebaDoc(id, data);
}

function validateInput(body: Partial<ControlPruebaExpedienteInput>): string | null {
  if (!body.caratula?.trim()) return 'La carátula es obligatoria';
  return null;
}

/** GET /api/admin/control-prueba — lista expedientes con control de prueba */
export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim().toLowerCase();

    // Propios + compartidos conmigo
    const [ownedSnap, sharedSnap] = await Promise.all([
      adminDb.collection(CONTROL_PRUEBA_COLLECTION).where('createdBy', '==', auth.uid).limit(100).get(),
      adminDb
        .collection(CONTROL_PRUEBA_COLLECTION)
        .where('sharedWithUids', 'array-contains', auth.uid)
        .limit(100)
        .get(),
    ]);

    const byId = new Map<string, ReturnType<typeof serializeDoc>>();
    for (const d of ownedSnap.docs) {
      const exp = serializeDoc(d.id, d.data());
      exp.myAccess = 'owner';
      byId.set(d.id, exp);
    }
    for (const d of sharedSnap.docs) {
      if (byId.has(d.id)) continue;
      const exp = serializeDoc(d.id, d.data());
      exp.myAccess = resolveResourceAccess(d.data(), auth.uid, 'createdBy') ?? 'view';
      byId.set(d.id, exp);
    }
    let expedientes = Array.from(byId.values());

    expedientes.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    if (q) {
      expedientes = expedientes.filter((exp) => {
        const haystack = [
          exp.caratula,
          exp.numeroExpediente,
          exp.juzgado,
          exp.fuero,
          exp.notas,
          ...exp.items.map((i) => i.descripcion),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return NextResponse.json({
      ok: true,
      expedientes,
      quota: auth.unlimited
        ? null
        : {
            remaining: auth.access.remaining,
            limit: auth.access.limit,
            used: auth.access.used,
            canCreate: auth.access.canCreate,
            monthlyResetAt: auth.access.monthlyResetAt ?? null,
          },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** POST /api/admin/control-prueba — crea un expediente de control de prueba */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    if (!auth.unlimited && !auth.access.canCreate) {
      return NextResponse.json(
        {
          ok: false,
          error: `Alcanzaste el límite de ${auth.access.limit ?? 10} controles este mes. Se renueva automáticamente.`,
        },
        { status: 403 },
      );
    }

    if (!auth.access.hasAccess) {
      return NextResponse.json(
        { ok: false, error: 'Acceso restringido a Control de prueba' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Partial<ControlPruebaExpedienteInput>;
    const error = validateInput(body);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const adminDb = getAdminDb();

    if (!auth.unlimited) {
      const quota = await consumeControlPruebaQuota(adminDb, auth.uid, {
        email: auth.userData.email as string | undefined,
        controlPruebaTrial: auth.userData.controlPruebaTrial as ControlPruebaTrial | undefined,
      });
      if (!quota.ok) {
        return NextResponse.json({ ok: false, error: quota.error }, { status: 403 });
      }
    }

    const now = FieldValue.serverTimestamp();
    const expedienteUrl = body.expedienteUrl?.trim() ?? '';
    const record = {
      caratula: repairSpanishTextEncoding(body.caratula!.trim()),
      numeroExpediente: body.numeroExpediente?.trim() ?? '',
      juzgado: repairSpanishTextEncoding(body.juzgado?.trim() ?? ''),
      fuero: repairSpanishTextEncoding(body.fuero?.trim() ?? ''),
      expedienteUrl,
      sistema: body.sistema ?? detectSistemaFromUrl(expedienteUrl),
      notas: repairSpanishTextEncoding(body.notas?.trim() ?? ''),
      items: sanitizeForFirestore(normalizeItems(body.items)),
      createdAt: now,
      updatedAt: now,
      createdBy: auth.uid,
    };

    const ref = await adminDb.collection(CONTROL_PRUEBA_COLLECTION).add(record);
    const created = await ref.get();

    return NextResponse.json({
      ok: true,
      expediente: serializeDoc(ref.id, created.data() ?? record),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: NextMessage(err) },
      { status: 500 },
    );
  }
}

function NextMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Error';
}
