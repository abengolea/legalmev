'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { sendEmailVerification, type User } from 'firebase/auth';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Página mostrada cuando el usuario se registró pero aún no verificó su email.
 * Bloquea el acceso al dashboard hasta que haga clic en el link del correo.
 */
export default function VerificaEmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setUser(null);
        setReady(true);
        router.replace('/login');
        return;
      }
      await u.reload();
      const fresh = auth.currentUser;
      setUser(fresh);
      setReady(true);
      if (fresh?.emailVerified) {
        router.replace('/dashboard');
      }
    });
    return () => unsub();
  }, [router]);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        toast({
          title: 'Correo reenviado',
          description: 'Revisá tu bandeja de entrada (y la carpeta de spam).',
        });
      } else if (res.status === 500) {
        // Fallback a Firebase cuando Resend no está configurado
        await sendEmailVerification(user);
        toast({
          title: 'Correo reenviado',
          description: 'Revisá tu bandeja de entrada (y la carpeta de spam).',
        });
      } else {
        throw new Error(json.error || 'Error');
      }
    } catch (err) {
      console.error('Error resending verification:', err);
      toast({
        variant: 'destructive',
        title: 'No se pudo reenviar',
        description: 'Intentá de nuevo en unos minutos.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleAlreadyVerified = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await user.reload();
      const fresh = auth.currentUser;
      if (fresh?.emailVerified) {
        router.replace('/dashboard');
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Aún no detectamos la verificación',
        description: 'Revisá que hayas hecho clic en el enlace del correo. Si acabás de hacerlo, esperá unos segundos e intentá de nuevo.',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Intentá de nuevo.' });
    } finally {
      setChecking(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <div className="mx-auto w-full max-w-[400px] space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Verificá tu correo electrónico</h1>
          <p className="text-muted-foreground text-sm">
            Te enviamos un correo a <strong>{user?.email ?? user?.providerData?.[0]?.email ?? 'tu correo'}</strong>. Hacé clic en el enlace que aparece en el mensaje para activar tu cuenta.
          </p>
          <p className="text-muted-foreground text-xs">
            Si no lo ves, revisá la carpeta de spam o correo no deseado.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" onClick={handleResend} disabled={resending} className="w-full">
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reenviando...
              </>
            ) : (
              'Reenviar correo de verificación'
            )}
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleAlreadyVerified} disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Ya verifiqué, continuar al dashboard'
            )}
          </Button>
          <Button asChild variant="link" className="w-full text-muted-foreground">
            <Link href="/login">Cerrar sesión e iniciar de nuevo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
