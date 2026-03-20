import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { parseMembersFile } from '@/lib/parse-members-file';

/** Verifica que el usuario sea admin */
async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: 'No autenticado' as const, status: 401 };
  const adminAuth = getAuth();
  const decoded = await adminAuth.verifyIdToken(token);
  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (userSnap.data()?.role !== 'admin') return { error: 'Solo administradores' as const, status: 403 };
  return { uid: decoded.uid, adminDb };
}

/**
 * POST /api/admin/colegios/[id]/upload
 * Sube Excel con emails y nombres. Asigna premium a usuarios existentes y guarda pendientes.
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

    const data = colegioSnap.data();
    if (!data?.convenioActivo) return NextResponse.json({ ok: false, error: 'Convenio suspendido' }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseMembersFile(buffer, file.name);

    const members: { email: string; name: string }[] = [];
    let actualizados = 0;
    let creados = 0;

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
        creados++; // pendiente de registro
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
      pendientes: creados,
      message: `${actualizados} usuarios actualizados a premium. ${creados} pendientes (se asignará al registrarse).`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
