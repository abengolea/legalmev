'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import {
  USER_INVITE_CONFIRM,
  USER_INVITE_DEFAULT_SUBJECT,
  USER_INVITE_MAX_RECIPIENTS,
  parseEmailList,
} from '@/lib/user-invite-email.constants';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2, Mail, Send, UserPlus } from 'lucide-react';

type InviteStats = {
  resendConfigured: boolean;
  maxRecipients: number;
  confirmPhrase: string;
};

export function InviteEmailsCard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawEmails, setRawEmails] = useState('');
  const [subject, setSubject] = useState(USER_INVITE_DEFAULT_SUBJECT);
  const [customMessage, setCustomMessage] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  const parsed = useMemo(() => parseEmailList(rawEmails), [rawEmails]);
  const maxRecipients = stats?.maxRecipients ?? USER_INVITE_MAX_RECIPIENTS;
  const confirmPhrase = stats?.confirmPhrase ?? USER_INVITE_CONFIRM;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email/invitations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok: boolean } & InviteStats>(res);
      if (json.ok) {
        setStats({
          resendConfigured: json.resendConfigured,
          maxRecipients: json.maxRecipients,
          confirmPhrase: json.confirmPhrase,
        });
        setTestEmail((prev) => prev || user.email || '');
      }
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const res = await fetch('/api/admin/email/invitations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'test',
          email: testEmail.trim(),
          subject: subject.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
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
    if (confirmText !== confirmPhrase) {
      toast({
        variant: 'destructive',
        title: 'Confirmación incorrecta',
        description: `Escribí exactamente: ${confirmPhrase}`,
      });
      return;
    }
    if (parsed.emails.length === 0) {
      toast({ variant: 'destructive', title: 'No hay emails válidos en la lista' });
      return;
    }
    if (parsed.emails.length > maxRecipients) {
      toast({
        variant: 'destructive',
        title: 'Demasiados destinatarios',
        description: `Máximo ${maxRecipients} por envío.`,
      });
      return;
    }

    setSendingBulk(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/email/invitations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'send',
          emails: parsed.emails,
          confirm: confirmText,
          subject: subject.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
      });
      const json = await safeResJson<{
        ok: boolean;
        message?: string;
        sent?: number;
        failed?: number;
        failedEmails?: string[];
        error?: string;
      }>(res);
      if (!json.ok) throw new Error(json.error || 'Error');
      toast({
        title: 'Invitaciones enviadas',
        description: json.message,
      });
      setConfirmText('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al enviar',
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
          <UserPlus className="h-5 w-5 text-primary" />
          Invitaciones a LegalMev
        </CardTitle>
        <CardDescription>
          Pegá una lista de correos (coma, punto y coma o saltos de línea) y enviá una invitación
          individual por Resend. Cada destinatario recibe su propio mail (sin CC, para no exponer
          emails). El botón lleva a crear cuenta con el email prefijado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : !stats?.resendConfigured ? (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            Resend no está configurado. Agregá RESEND_API_KEY y RESEND_FROM en el entorno.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="invite-subject">Asunto</Label>
          <Input
            id="invite-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!stats?.resendConfigured}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-message">Mensaje opcional (se inserta en el cuerpo)</Label>
          <Textarea
            id="invite-message"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Ej.: Te escribo porque creemos que LegalMev puede ayudarte en tu estudio…"
            rows={3}
            disabled={!stats?.resendConfigured}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="invite-emails">Destinatarios</Label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {parsed.emails.length} válido(s)
              {parsed.invalid.length > 0 ? ` · ${parsed.invalid.length} inválido(s)` : ''}
              {` · máx. ${maxRecipients}`}
            </span>
          </div>
          <Textarea
            id="invite-emails"
            value={rawEmails}
            onChange={(e) => setRawEmails(e.target.value)}
            placeholder="dr.ejemplo@hotmail.com; otro@gmail.com&#10;tercero@yahoo.com.ar"
            rows={8}
            className="font-mono text-sm"
            disabled={!stats?.resendConfigured}
          />
          {parsed.invalid.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Se omitirán: {parsed.invalid.slice(0, 8).join(', ')}
              {parsed.invalid.length > 8 ? '…' : ''}
            </p>
          )}
        </div>

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
              <p className="font-medium text-sm">2. Enviar invitaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Se enviará un correo individual a <strong>{parsed.emails.length}</strong>{' '}
                destinatario(s). Esta acción no se puede deshacer.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-invites" className="text-xs">
              Escribí <code className="text-xs bg-muted px-1 rounded">{confirmPhrase}</code> para
              confirmar
            </Label>
            <Input
              id="confirm-invites"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmPhrase}
              disabled={!stats?.resendConfigured || sendingBulk}
              className="max-w-sm font-mono text-sm"
            />
          </div>

          <Button
            type="button"
            disabled={
              !stats?.resendConfigured ||
              sendingBulk ||
              parsed.emails.length === 0 ||
              parsed.emails.length > maxRecipients ||
              confirmText !== confirmPhrase
            }
            onClick={() => void handleBulkSend()}
          >
            {sendingBulk ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Enviar a {parsed.emails.length} destinatario(s)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
