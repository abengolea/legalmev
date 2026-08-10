/** ACL de recursos compartidos entre usuarios registrados (Control de prueba / Copiloto). */

export type ShareRole = 'view' | 'edit';

export type SharedCollaborator = {
  uid: string;
  email: string;
  name: string;
  role: ShareRole;
  sharedAt: string;
  sharedBy: string;
};

export type ResourceAccessLevel = 'owner' | ShareRole;

export function isShareRole(value: unknown): value is ShareRole {
  return value === 'view' || value === 'edit';
}

export function normalizeSharedWith(raw: unknown): SharedCollaborator[] {
  if (!Array.isArray(raw)) return [];
  const out: SharedCollaborator[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const uid = typeof o.uid === 'string' ? o.uid.trim() : '';
    const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
    if (!uid || !email || !isShareRole(o.role)) continue;
    out.push({
      uid,
      email,
      name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : email.split('@')[0],
      role: o.role,
      sharedAt: typeof o.sharedAt === 'string' ? o.sharedAt : new Date().toISOString(),
      sharedBy: typeof o.sharedBy === 'string' ? o.sharedBy : '',
    });
  }
  return out;
}

export function sharedWithUidsFrom(list: SharedCollaborator[]): string[] {
  return [...new Set(list.map((c) => c.uid).filter(Boolean))];
}

export function getOwnerUid(
  data: FirebaseFirestore.DocumentData | Record<string, unknown> | null | undefined,
  ownerField: 'createdBy' | 'userId',
): string | null {
  if (!data) return null;
  const v = data[ownerField];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function resolveResourceAccess(
  data: FirebaseFirestore.DocumentData | Record<string, unknown> | null | undefined,
  uid: string,
  ownerField: 'createdBy' | 'userId',
): ResourceAccessLevel | null {
  if (!data || !uid) return null;
  const owner = getOwnerUid(data, ownerField);
  if (owner === uid) return 'owner';
  const collab = normalizeSharedWith(data.sharedWith).find((c) => c.uid === uid);
  return collab?.role ?? null;
}

export function canViewResource(level: ResourceAccessLevel | null): boolean {
  return level === 'owner' || level === 'view' || level === 'edit';
}

export function canEditResource(level: ResourceAccessLevel | null): boolean {
  return level === 'owner' || level === 'edit';
}

export function isResourceOwner(level: ResourceAccessLevel | null): boolean {
  return level === 'owner';
}

export function upsertCollaborator(
  existing: SharedCollaborator[],
  next: SharedCollaborator,
): SharedCollaborator[] {
  const without = existing.filter((c) => c.uid !== next.uid && c.email !== next.email);
  return [...without, next];
}

export function removeCollaborator(
  existing: SharedCollaborator[],
  uid: string,
): SharedCollaborator[] {
  return existing.filter((c) => c.uid !== uid);
}

export function roleLabelEs(role: ShareRole): string {
  return role === 'edit' ? 'editar' : 'ver';
}
