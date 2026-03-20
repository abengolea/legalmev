import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * PATCH /api/admin/colegios/[id]
 * Actualiza un colegio (cuotaMensual, nombre, etc.). Solo admins.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if ('cuotaMensual' in body) update.cuotaMensual = (typeof body.cuotaMensual === 'number' && body.cuotaMensual >= 0) ? body.cuotaMensual : null;
    if ('name' in body && typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if ('montoConvenio' in body) update.montoConvenio = (typeof body.montoConvenio === 'number' && body.montoConvenio >= 0) ? body.montoConvenio : null;
    if ('moneda' in body && typeof body.moneda === 'string') update.moneda = body.moneda;
    if ('periodoFacturacion' in body && typeof body.periodoFacturacion === 'string') update.periodoFacturacion = body.periodoFacturacion;
    if ('notas' in body) update.notas = typeof body.notas === 'string' ? body.notas : '';
    if ('contactoFacturacion' in body) update.contactoFacturacion = typeof body.contactoFacturacion === 'string' ? body.contactoFacturacion : '';
    if ('cuit' in body) {
      const cuit = typeof body.cuit === 'string' ? body.cuit.trim().replace(/\D/g, '') : '';
      update.cuit = cuit || null;
    }
    if ('adminEmails' in body && Array.isArray(body.adminEmails)) {
      update.adminEmails = (body.adminEmails as string[])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter(Boolean);
    }

    await adminDb.collection('colegios').doc(id).update(update);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
