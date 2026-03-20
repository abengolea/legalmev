import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/pagos
 * Lista pagos con filtros opcionales. Solo admins.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const tipoFilter = searchParams.get('tipo'); // cliente | colegio
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50);

    const snap = await adminDb.collection('pagos').orderBy('createdAt', 'desc').limit(limit * 2).get();
    let pagos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (tipoFilter === 'cliente' || tipoFilter === 'colegio') {
      pagos = pagos.filter((p) => (p as { tipo?: string }).tipo === tipoFilter).slice(0, limit);
    } else {
      pagos = pagos.slice(0, limit);
    }

    return NextResponse.json({ ok: true, pagos });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/admin/pagos
 * Registra un pago manual (ej. transferencia, convenio colegio). Solo admins.
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
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const tipo = body.tipo as 'cliente' | 'colegio';
    if (tipo !== 'cliente' && tipo !== 'colegio') {
      return NextResponse.json({ ok: false, error: 'tipo debe ser cliente o colegio' }, { status: 400 });
    }

    const monto = Number(body.monto);
    if (isNaN(monto) || monto <= 0) {
      return NextResponse.json({ ok: false, error: 'monto inválido' }, { status: 400 });
    }

    const record: Record<string, unknown> = {
      tipo,
      monto,
      moneda: body.moneda ?? 'ARS',
      metodo: body.metodo ?? 'manual',
      estado: body.estado ?? 'completado',
      descripcion: body.descripcion ?? '',
      createdBy: uid,
    };

    if (tipo === 'cliente' && body.clienteId) record.clienteId = body.clienteId;
    if (tipo === 'colegio') {
      if (body.colegioId) record.colegioId = body.colegioId;
      if (body.colegioName) record.colegioName = body.colegioName;
      if (body.periodo) record.periodo = body.periodo; // ej. "2025-03"
    }

    const { recordPayment } = await import('@/lib/payments');
    const id = await recordPayment(adminDb, record as Parameters<typeof recordPayment>[1]);

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
