'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import {
  COPILOTO_ANNOUNCEMENT_CONFIRM,
} from '@/lib/copiloto-announcement-email.constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2, Mail, Send } from 'lucide-react';

type CampaignStats = {
  resendConfigured: boolean;
  pending: number;
  alreadySent: number;
  skippedNoEmail: number;
  skippedInactive: number;
  lastRun: {
    sentAt?: string;
    sentCount?: number;
    failedCount?: number;
  } | null;
};

export function CopilotoAnnouncementEmailCard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const qs = skipAlreadySent ? '' : '?skipAlreadySent=false';
      const res = await fetch(`/api/admin/email/copiloto-announcement${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok: boolean } & CampaignStats>(res);
      if (json.ok) setStats(json);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [skipAlreadySent]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleTest = async () => {
    if (!testEmail.trim()) {
      toast({ variant: 'destructive', title: 'Indicá un email de prueba' });
      return;
    }
    setSendingTest(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email/copiloto-announcement', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'test', email: testEmail.trim() }),
      });
      const json = await safeResJson<{ ok: boolean; message?: string; error?: string }>(res);
      if (!json.ok) throw new Error(json.error || 'Error');
      toast({ title: 'Prueba enviada', description: json.message });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo enviar',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleBulkSend = async () => {
    if (confirmText !== COPILOTO_ANNOUNCEMENT_CONFIRM) {
      toast({
        variant: 'destructive',
        title: 'Confirmación incorrecta',
        description: `Escribí exactamente: ${COPILOTO_ANNOUNCEMENT_CONFIRM}`,
      });
      return;
    }
    if (!stats?.pending) {
      toast({ variant: 'destructive', title: 'No hay destinatarios pendientes' });
      return;
    }

    setSendingBulk(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email/copiloto-announcement', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'send',
          confirm: confirmText,
          skipAlreadySent,
        }),
      });
      const json = await safeResJson<{
        ok: boolean;
        message?: string;
        sent?: number;
        failed?: number;
        error?: string;
      }>(res);
      if (!json.ok) throw new Error(json.error || 'Error');
      toast({
        title: 'Campaña enviada',
        description: json.message,
      });
      setConfirmText('');
      void fetchStats();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error en campaña',
        description: err instanceof Error ? err.message : 'No se pudo enviar',
      });
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Anuncio por email — Copiloto de Audiencias
        </CardTitle>
        <CardDescription>
          Enviá a los usuarios registrados un correo sobre el Copiloto de Audiencias (fase de prueba,
          1 audiencia incluida, pedido de devoluciones). Probá primero con tu email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando estadísticas…
          </p>
        ) : !stats?.resendConfigured ? (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            Resend no está configurado. Agregá RESEND_API_KEY y RESEND_FROM en el entorno.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-muted-foreground text-xs">Pendientes</p>
              <p className="text-2xl font-bold tabular-nums">{stats.pending}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-muted-foreground text-xs">Ya enviados</p>
              <p className="text-2xl font-bold tabular-nums">{stats.alreadySent}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-muted-foreground text-xs">Sin email / inactivos</p>
              <p className="text-2xl font-bold tabular-nums">
                {stats.skippedNoEmail + stats.skippedInactive}
              </p>
            </div>
          </div>
        )}

        {stats?.lastRun?.sentAt && (
          <p className="text-xs text-muted-foreground">
            Último envío masivo:{' '}
            {new Date(stats.lastRun.sentAt).toLocaleString('es-AR')} — {stats.lastRun.sentCount ?? 0}{' '}
            enviados
            {(stats.lastRun.failedCount ?? 0) > 0
              ? `, ${stats.lastRun.failedCount} fallidos`
              : ''}
          </p>
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-medium text-sm">1. Enviar prueba</p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
              disabled={!stats?.resendConfigured || sendingTest}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!stats?.resendConfigured || sendingTest}
              onClick={() => void handleTest()}
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar prueba
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-medium text-sm">2. Envío masivo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Se enviará a <strong>{stats?.pending ?? 0}</strong> usuario(s) registrados con email
                válido. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={skipAlreadySent}
              onCheckedChange={(v) => setSkipAlreadySent(v === true)}
            />
            Solo a quienes aún no recibieron este anuncio
          </label>

          <div className="space-y-2">
            <Label htmlFor="confirm-campaign" className="text-xs">
              Escribí <code className="text-xs bg-muted px-1 rounded">{COPILOTO_ANNOUNCEMENT_CONFIRM}</code>{' '}
              para confirmar
            </Label>
            <Input
              id="confirm-campaign"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={COPILOTO_ANNOUNCEMENT_CONFIRM}
              disabled={!stats?.resendConfigured || sendingBulk}
              className="max-w-sm font-mono text-sm"
            />
          </div>

          <Button
            type="button"
            disabled={
              !stats?.resendConfigured ||
              sendingBulk ||
              !stats.pending ||
              confirmText !== COPILOTO_ANNOUNCEMENT_CONFIRM
            }
            onClick={() => void handleBulkSend()}
          >
            {sendingBulk ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando campaña…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Enviar a {stats?.pending ?? 0} usuario(s)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
