import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * GET /api/admin/pagos
 * Lista pagos con filtros opcionales. Solo admins.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();

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

    const clienteIds = [
      ...new Set(
        pagos
          .map((p) => (p as { clienteId?: string }).clienteId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    if (clienteIds.length > 0) {
      const userSnaps = await Promise.all(
        clienteIds.map((id) => adminDb.collection('users').doc(id).get()),
      );
      const userMap = new Map<string, { clienteNombre: string; clienteEmail: string }>();
      for (const userSnap of userSnaps) {
        if (!userSnap.exists) continue;
        const data = userSnap.data() ?? {};
        userMap.set(userSnap.id, {
          clienteNombre: typeof data.name === 'string' ? data.name : '',
          clienteEmail: typeof data.email === 'string' ? data.email : '',
        });
      }

      pagos = pagos.map((p) => {
        const clienteId = (p as { clienteId?: string }).clienteId;
        if (!clienteId) return p;
        const user = userMap.get(clienteId);
        if (!user) return p;
        return { ...p, ...user };
      });
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
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const adminDb = getAdminDb();

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
