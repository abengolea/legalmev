import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { normalizeMembers, syncUserTiersForColegio } from '@/lib/colegio-members';
import type { ColegioMember } from '@/lib/colegio-members';

/** Obtiene el colegio que el usuario administra */
async function getColegioForAdmin(adminDb: ReturnType<typeof getAdminDb>, email: string) {
  const colegiosSnap = await adminDb
    .collection('colegios')
    .where('adminEmails', 'array-contains', email)
    .limit(1)
    .get();
  if (colegiosSnap.empty) return null;
  const doc = colegiosSnap.docs[0];
  return { id: doc.id, data: doc.data(), ref: doc.ref };
}

/**
 * POST /api/colegio/members
 * Agrega un colegiado manualmente (estado activo).
 * Body: { email: string, name?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: 'Sin email' }, { status: 400 });

    const colegio = await getColegioForAdmin(adminDb, email);
    if (!colegio) return NextResponse.json({ ok: false, error: 'No administrás ningún colegio' }, { status: 403 });
    if (!colegio.data?.convenioActivo) return NextResponse.json({ ok: false, error: 'Convenio suspendido' }, { status: 400 });

    const body = await request.json();
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!rawEmail) return NextResponse.json({ ok: false, error: 'Email requerido' }, { status: 400 });

    const members = normalizeMembers((colegio.data.members || []) as ColegioMember[]);
    const idx = members.findIndex((m) => m.email === rawEmail);
    const newMember: ColegioMember = { email: rawEmail, name: rawName || rawEmail.split('@')[0], estado: 'activo' };

    if (idx >= 0) {
      if (members[idx].estado === 'activo') {
        return NextResponse.json({ ok: false, error: 'Ya está en la lista como activo' }, { status: 400 });
      }
      members[idx] = newMember; // reactivar
    } else {
      members.push(newMember);
    }

    const { activated } = await syncUserTiersForColegio(adminDb, colegio.id, (colegio.data.name as string) || '', members);
    await colegio.ref.update({ members, updatedAt: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      message: idx >= 0 ? 'Colegiado reactivado' : 'Colegiado agregado',
      activated,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/colegio/members
 * Suspende o reactiva un colegiado.
 * Body: { email: string, estado: 'activo' | 'suspendido' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: 'Sin email' }, { status: 400 });

    const colegio = await getColegioForAdmin(adminDb, email);
    if (!colegio) return NextResponse.json({ ok: false, error: 'No administrás ningún colegio' }, { status: 403 });
    if (!colegio.data?.convenioActivo) return NextResponse.json({ ok: false, error: 'Convenio suspendido' }, { status: 400 });

    const body = await request.json();
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const newEstado = body.estado === 'suspendido' ? 'suspendido' : 'activo';
    if (!rawEmail) return NextResponse.json({ ok: false, error: 'Email requerido' }, { status: 400 });

    const members = normalizeMembers((colegio.data.members || []) as ColegioMember[]);
    const idx = members.findIndex((m) => m.email === rawEmail);
    if (idx < 0) return NextResponse.json({ ok: false, error: 'Colegiado no encontrado en la lista' }, { status: 404 });
    if (members[idx].estado === newEstado) {
      return NextResponse.json({ ok: false, error: `Ya está ${newEstado}` }, { status: 400 });
    }

    members[idx] = { ...members[idx], estado: newEstado };
    const { activated, suspended } = await syncUserTiersForColegio(adminDb, colegio.id, (colegio.data.name as string) || '', members);
    await colegio.ref.update({ members, updatedAt: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      message: newEstado === 'activo' ? 'Colegiado reactivado' : 'Colegiado suspendido',
      activated,
      suspended,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
