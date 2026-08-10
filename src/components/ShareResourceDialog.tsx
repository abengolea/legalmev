'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, Trash2 } from 'lucide-react';
import type { ShareRole, SharedCollaborator } from '@/lib/resource-sharing';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Base path without trailing slash, e.g. /api/admin/control-prueba/{id}/share */
  shareApiPath: string;
  resourceTitle: string;
  resourceKindLabel: string;
  onSharedWithChange?: (sharedWith: SharedCollaborator[]) => void;
};

export function ShareResourceDialog({
  open,
  onOpenChange,
  shareApiPath,
  resourceTitle,
  resourceKindLabel,
  onSharedWithChange,
}: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('view');
  const [sharedWith, setSharedWith] = useState<SharedCollaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No autenticado');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const loadCollaborators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(shareApiPath, { headers });
      const json = await safeResJson<{ ok?: boolean; sharedWith?: SharedCollaborator[]; error?: string }>(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo cargar la lista');
        return;
      }
      setSharedWith(json.sharedWith ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, shareApiPath]);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setRole('view');
    setError(null);
    setInfo(null);
    void loadCollaborators();
  }, [open, loadCollaborators]);

  const handleShare = async () => {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(shareApiPath, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await safeResJson<{
        ok?: boolean;
        error?: string;
        code?: string;
        sharedWith?: SharedCollaborator[];
        emailSent?: boolean;
        emailError?: string | null;
      }>(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo compartir');
        return;
      }
      const next = json.sharedWith ?? [];
      setSharedWith(next);
      onSharedWithChange?.(next);
      setEmail('');
      if (json.emailSent) {
        setInfo('Compartido. Se envió un email de aviso.');
      } else if (json.emailError) {
        setInfo(`Compartido, pero el email no se envió: ${json.emailError}`);
      } else {
        setInfo('Compartido correctamente.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (uid: string, nextRole: ShareRole) => {
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(shareApiPath, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ uid, role: nextRole }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string; sharedWith?: SharedCollaborator[] }>(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo actualizar el permiso');
        return;
      }
      const next = json.sharedWith ?? [];
      setSharedWith(next);
      onSharedWithChange?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleRevoke = async (uid: string) => {
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${shareApiPath}?uid=${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers,
      });
      const json = await safeResJson<{ ok?: boolean; error?: string; sharedWith?: SharedCollaborator[] }>(res);
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo quitar el acceso');
        return;
      }
      const next = json.sharedWith ?? [];
      setSharedWith(next);
      onSharedWithChange?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            Compartir {resourceKindLabel}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {resourceTitle || 'Sin título'}. Solo usuarios registrados en LegalMev. El destinatario podrá ver o
            editar según el permiso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Email del usuario</Label>
            <Input
              id="share-email"
              type="email"
              autoComplete="email"
              placeholder="colegio@estudio.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Permiso</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ShareRole)} disabled={submitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Solo ver</SelectItem>
                <SelectItem value="edit">Ver y editar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {info && !error && <p className="text-sm text-muted-foreground">{info}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cerrar
            </Button>
            <Button type="button" onClick={() => void handleShare()} disabled={submitting || !email.trim()}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Compartir
            </Button>
          </DialogFooter>

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Personas con acceso</p>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sharedWith.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no compartiste con nadie.</p>
            ) : (
              <ul className="space-y-2">
                {sharedWith.map((c) => (
                  <li
                    key={c.uid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={c.role}
                        onValueChange={(v) => void handleRoleChange(c.uid, v as ShareRole)}
                      >
                        <SelectTrigger className="h-8 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Ver</SelectItem>
                          <SelectItem value="edit">Editar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Quitar acceso"
                        onClick={() => void handleRevoke(c.uid)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {sharedWith.length > 0 && (
              <div className="mt-2 flex gap-2">
                <Badge variant="secondary" className="font-normal">
                  {sharedWith.filter((c) => c.role === 'view').length} ver
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  {sharedWith.filter((c) => c.role === 'edit').length} editar
                </Badge>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
