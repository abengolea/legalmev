import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { parseMembersFile } from '@/lib/parse-members-file';
import { normalizeMembers, syncUserTiersForColegio } from '@/lib/colegio-members';
import type { ColegioMember } from '@/lib/colegio-members';

/**
 * POST /api/colegio/upload
 * Sube Excel/CSV con los colegiados al día (matrícula pagada).
 * Los que están en el archivo quedan ACTIVOS; los que no, SUSPENDIDOS.
 * Body: FormData con campo 'file' y opcional 'colegioId'.
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

    const existingMembers = normalizeMembers((data?.members || []) as ColegioMember[]);
    const emailsEnExcel = new Set(rows.map((r) => r.email.toLowerCase()));

    // Integrar: los del Excel = activo; los que ya estaban y NO están en Excel = suspendido
    const membersMap = new Map<string, ColegioMember>();
    for (const m of existingMembers) {
      membersMap.set(m.email, {
        ...m,
        estado: emailsEnExcel.has(m.email) ? 'activo' : 'suspendido',
      });
    }
    for (const row of rows) {
      const e = row.email.toLowerCase();
      if (!membersMap.has(e)) {
        membersMap.set(e, { email: e, name: row.name, estado: 'activo' });
      } else {
        const prev = membersMap.get(e)!;
        membersMap.set(e, { ...prev, name: row.name, estado: 'activo' });
      }
    }

    const members: ColegioMember[] = Array.from(membersMap.values());

    const { activated, suspended } = await syncUserTiersForColegio(
      adminDb,
      colegioId,
      (data?.name as string) || '',
      members
    );

    await adminDb.collection('colegios').doc(colegioId).update({
      members,
      updatedAt: new Date().toISOString(),
    });

    const activosCount = members.filter((m) => m.estado !== 'suspendido').length;
    const suspendidosCount = members.filter((m) => m.estado === 'suspendido').length;

    return NextResponse.json({
      ok: true,
      total: members.length,
      activos: activosCount,
      suspendidos: suspendidosCount,
      usuariosActivados: activated,
      usuariosSuspendidos: suspended,
      message: `${activosCount} al día, ${suspendidosCount} suspendidos por falta de pago. ${activated} usuarios activados, ${suspended} suspendidos.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
