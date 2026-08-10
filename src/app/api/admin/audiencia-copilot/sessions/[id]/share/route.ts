import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeAudienciaCopilot } from '@/lib/audiencia-copilot-api-auth';
import { assertAudienciaSessionAccess } from '@/lib/audiencia-session-access';
import { findRegisteredUserByEmail } from '@/lib/notificas-integration';
import { normalizeEmail } from '@/lib/platform-admin';
import {
  isShareRole,
  normalizeSharedWith,
  removeCollaborator,
  sharedWithUidsFrom,
  upsertCollaborator,
  type ShareRole,
  type SharedCollaborator,
} from '@/lib/resource-sharing';
import { sendResourceShareNotification } from '@/lib/share-notification-email';

type RouteContext = { params: Promise<{ id: string }> };

function sharerDisplayName(userData: Record<string, unknown>): string {
  const name = typeof userData.name === 'string' ? userData.name.trim() : '';
  if (name) return name;
  const email = typeof userData.email === 'string' ? userData.email.trim() : '';
  return email || 'Un usuario de LegalMev';
}

/** GET — lista colaboradores (solo dueño). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const adminDb = getAdminDb();
    const owned = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'owner');
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    return NextResponse.json({
      ok: true,
      sharedWith: normalizeSharedWith(owned.data.sharedWith),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** POST — compartir con email de usuario registrado (solo dueño). */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json()) as { email?: string; role?: string };
    const email = normalizeEmail(body.email ?? '');
    const role: ShareRole = isShareRole(body.role) ? body.role : 'view';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Ingresá un email válido' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const owned = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'owner');
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    const ownerEmail = normalizeEmail(String(auth.userData.email ?? ''));
    if (email === ownerEmail) {
      return NextResponse.json(
        { ok: false, error: 'No podés compartirte el recurso a vos mismo' },
        { status: 400 },
      );
    }

    const target = await findRegisteredUserByEmail(email);
    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No hay un usuario registrado con ese email. Revisá el correo o pedile que se registre en LegalMev.',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (target.uid === auth.uid) {
      return NextResponse.json(
        { ok: false, error: 'No podés compartirte el recurso a vos mismo' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const existing = normalizeSharedWith(owned.data.sharedWith);
    const collab: SharedCollaborator = {
      uid: target.uid,
      email,
      name: target.name,
      role,
      sharedAt: existing.find((c) => c.uid === target.uid)?.sharedAt ?? now,
      sharedBy: auth.uid,
    };
    const sharedWith = upsertCollaborator(existing, collab);

    await owned.ref.update({
      sharedWith,
      sharedWithUids: sharedWithUidsFrom(sharedWith),
      updatedAt: now,
    });

    const emailResult = await sendResourceShareNotification({
      toEmail: email,
      recipientName: target.name,
      sharerName: sharerDisplayName(auth.userData),
      kind: 'copiloto-audiencias',
      resourceId: id,
      resourceTitle: String(owned.data.titulo ?? 'Audiencia'),
      role,
    });

    return NextResponse.json({
      ok: true,
      sharedWith,
      collaborator: collab,
      emailSent: emailResult.sent,
      emailError: emailResult.error ?? null,
      myAccess: 'owner' as const,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** PATCH — cambiar rol (solo dueño). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json()) as { uid?: string; role?: string };
    const targetUid = typeof body.uid === 'string' ? body.uid.trim() : '';
    if (!targetUid || !isShareRole(body.role)) {
      return NextResponse.json(
        { ok: false, error: 'uid y role (view|edit) son obligatorios' },
        { status: 400 },
      );
    }

    const adminDb = getAdminDb();
    const owned = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'owner');
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    const existing = normalizeSharedWith(owned.data.sharedWith);
    const current = existing.find((c) => c.uid === targetUid);
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Colaborador no encontrado' }, { status: 404 });
    }

    const sharedWith = upsertCollaborator(existing, { ...current, role: body.role });
    await owned.ref.update({
      sharedWith,
      sharedWithUids: sharedWithUidsFrom(sharedWith),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, sharedWith });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** DELETE — revocar (?uid=) (solo dueño). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeAudienciaCopilot(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const targetUid = new URL(request.url).searchParams.get('uid')?.trim() ?? '';
    if (!targetUid) {
      return NextResponse.json({ ok: false, error: 'Falta uid del colaborador' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const owned = await assertAudienciaSessionAccess(adminDb, id, auth.uid, 'owner');
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    const sharedWith = removeCollaborator(normalizeSharedWith(owned.data.sharedWith), targetUid);
    await owned.ref.update({
      sharedWith,
      sharedWithUids: sharedWithUidsFrom(sharedWith),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, sharedWith });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}
