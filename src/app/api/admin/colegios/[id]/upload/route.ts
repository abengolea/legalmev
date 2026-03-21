import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { parseMembersFile } from '@/lib/parse-members-file';
import { normalizeMembers, syncUserTiersForColegio } from '@/lib/colegio-members';
import type { ColegioMember } from '@/lib/colegio-members';

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
 * Sube Excel con colegiados al día. Los del Excel = activo; el resto = suspendido.
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
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No se encontraron filas válidas' }, { status: 400 });
    }

    const existingMembers = normalizeMembers((data.members || []) as ColegioMember[]);
    const emailsEnExcel = new Set(rows.map((r) => r.email.toLowerCase()));
    const membersMap = new Map<string, ColegioMember>();

    for (const m of existingMembers) {
      membersMap.set(m.email, { ...m, estado: emailsEnExcel.has(m.email) ? 'activo' : 'suspendido' });
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

    const members = Array.from(membersMap.values());
    const { activated, suspended } = await syncUserTiersForColegio(
      adminDb,
      colegioId,
      (data.name as string) || '',
      members
    );

    await adminDb.collection('colegios').doc(colegioId).update({
      members,
      updatedAt: new Date().toISOString(),
    });

    const activos = members.filter((m) => m.estado !== 'suspendido').length;
    const suspendidos = members.filter((m) => m.estado === 'suspendido').length;

    return NextResponse.json({
      ok: true,
      total: members.length,
      activos,
      suspendidos,
      usuariosActivados: activated,
      usuariosSuspendidos: suspended,
      message: `${activos} al día, ${suspendidos} suspendidos. ${activated} usuarios activados, ${suspended} suspendidos.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
