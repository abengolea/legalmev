import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { parseMembersFile } from '@/lib/parse-members-file';

/**
 * POST /api/colegio/upload
 * Sube Excel o CSV con lista de emails y nombres autorizados.
 * Solo usuarios cuyo email está en colegio.adminEmails.
 * Body: FormData con campo 'file' y opcional 'colegioId' (si administra uno solo, se infiere).
 */
export async function POST(request: NextRequest) {
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
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Sin email' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Archivo requerido' }, { status: 400 });
    }

    const colegioIdParam = formData.get('colegioId') as string | null;
    let colegioSnap;

    if (colegioIdParam?.trim()) {
      colegioSnap = await adminDb.collection('colegios').doc(colegioIdParam.trim()).get();
    } else {
      const colegiosSnap = await adminDb
        .collection('colegios')
        .where('adminEmails', 'array-contains', email)
        .limit(1)
        .get();
      colegioSnap = colegiosSnap.empty ? null : colegiosSnap.docs[0];
    }

    if (!colegioSnap?.exists) {
      return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });
    }

    const doc = colegioSnap as { id: string; data: () => Record<string, unknown> };
    const colegioId = doc.id;
    const data = doc.data();

    const adminEmails = (data?.adminEmails || []) as string[];
    if (!adminEmails.map((e) => String(e).toLowerCase()).includes(email)) {
      return NextResponse.json({ ok: false, error: 'No tenés permiso para administrar este colegio' }, { status: 403 });
    }

    if (!data?.convenioActivo) {
      return NextResponse.json({ ok: false, error: 'Convenio suspendido. Contactá al administrador.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || '';
    const rows = parseMembersFile(buffer, filename);

    if (rows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No se encontraron filas válidas. El archivo debe tener columnas de email y nombre (o mail/correo, nombre/name).',
      }, { status: 400 });
    }

    const members: { email: string; name: string }[] = [];
    let actualizados = 0;
    let pendientes = 0;

    for (const row of rows) {
      members.push({ email: row.email, name: row.name });

      const usersSnap = await adminDb.collection('users').where('email', '==', row.email).limit(1).get();
      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        await userDoc.ref.update({
          tier: 'premium',
          colegioId,
          premiumSource: 'colegio',
          colegioName: data.name,
          downloadsThisMonth: 0,
          monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });
        actualizados++;
      } else {
        pendientes++;
      }
    }

    await adminDb.collection('colegios').doc(colegioId).update({
      members,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      total: rows.length,
      actualizados,
      pendientes,
      message: `${actualizados} usuarios actualizados a premium. ${pendientes} pendientes (se asignará al registrarse).`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
