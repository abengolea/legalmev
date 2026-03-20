'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { auth } from '@/lib/firebase';
import {
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Logo } from '@/components/Logo';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Controlador de acciones de correo electrónico de Firebase.
 * Maneja: verifyEmail, resetPassword, recoverEmail
 * Firebase Console → Authentication → Templates → Personalizar URL de acción:
 * https://www.legalmev.com.ar/auth/action
 */

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ActionHandlerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const actionCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');
  const lang = searchParams.get('lang') || 'es';

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'form'>('loading');
  const [message, setMessage] = useState('');
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });

  const redirectToApp = () => {
    const dest =
      continueUrl && continueUrl.startsWith('/') && !continueUrl.startsWith('//')
        ? continueUrl
        : '/dashboard';
    router.push(dest);
  };

  const handleVerifyEmail = async () => {
    if (!actionCode) {
      setStatus('error');
      setMessage('Código de verificación inválido o ausente.');
      return;
    }
    try {
      await applyActionCode(auth, actionCode);
      setStatus('success');
      setMessage('Tu correo electrónico fue verificado correctamente. Ya podés usar tu cuenta.');
    } catch (err: unknown) {
      const e = err as { code?: string };
      setStatus('error');
      if (e.code === 'auth/expired-action-code') {
        setMessage('El enlace venció. Volvé a solicitar la verificación de email desde tu cuenta.');
      } else if (e.code === 'auth/invalid-action-code') {
        setMessage('El enlace no es válido o ya fue usado.');
      } else {
        setMessage('No se pudo verificar el correo. Intentá de nuevo más tarde.');
      }
    }
  };

  const handleResetPasswordInit = async () => {
    if (!actionCode) {
      setStatus('error');
      setMessage('Código de restablecimiento inválido o ausente.');
      return;
    }
    try {
      const email = await verifyPasswordResetCode(auth, actionCode);
      setResetEmail(email);
      setStatus('form');
    } catch (err: unknown) {
      const e = err as { code?: string };
      setStatus('error');
      if (e.code === 'auth/expired-action-code') {
        setMessage('El enlace venció. Solicitá uno nuevo desde "¿Olvidaste tu contraseña?".');
      } else {
        setMessage('El enlace no es válido o ya fue usado.');
      }
    }
  };

  const handleResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    if (!actionCode) return;
    setStatus('loading');
    try {
      await confirmPasswordReset(auth, actionCode, data.password);
      setStatus('success');
      setMessage('Tu contraseña fue actualizada. Ya podés iniciar sesión con la nueva contraseña.');
    } catch (err: unknown) {
      const e = err as { code?: string };
      setStatus('error');
      if (e.code === 'auth/expired-action-code') {
        setMessage('El enlace venció. Solicitá uno nuevo.');
      } else {
        setMessage('No se pudo actualizar la contraseña. Intentá de nuevo.');
      }
    }
  };

  const handleRecoverEmail = async () => {
    if (!actionCode) {
      setStatus('error');
      setMessage('Código inválido o ausente.');
      return;
    }
    try {
      const info = await checkActionCode(auth, actionCode);
      const restoredEmail = info.data?.email as string | undefined;
      await applyActionCode(auth, actionCode);
      setStatus('success');
      setMessage(
        restoredEmail
          ? `Se revirtió el cambio. Tu correo volvió a ser ${restoredEmail}.`
          : 'Se revirtió el cambio de correo correctamente.'
      );
    } catch (err: unknown) {
      const e = err as { code?: string };
      setStatus('error');
      if (e.code === 'auth/expired-action-code') {
        setMessage('El enlace venció.');
      } else {
        setMessage('El enlace no es válido o ya fue usado.');
      }
    }
  };

  useEffect(() => {
    // Flujo Resend: verify-email redirige con verified=1 o error=
    const verified = searchParams.get('verified');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    if (verified === '1') {
      setStatus('success');
      setMessage('Tu correo electrónico fue verificado correctamente. Ya podés usar tu cuenta.');
      return;
    }
    if (errorParam && messageParam) {
      setStatus('error');
      setMessage(decodeURIComponent(messageParam));
      return;
    }

    // Flujo Firebase (verifyEmail, resetPassword, recoverEmail)
    if (!mode || !actionCode) {
      setStatus('error');
      setMessage('Faltan parámetros en el enlace. Abrí el correo que te enviamos y usá el botón del email.');
      return;
    }

    switch (mode) {
      case 'verifyEmail':
        void handleVerifyEmail();
        break;
      case 'resetPassword':
        void handleResetPasswordInit();
        break;
      case 'recoverEmail':
        void handleRecoverEmail();
        break;
      default:
        setStatus('error');
        setMessage('Acción no reconocida.');
    }
  }, [mode, actionCode]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <Logo />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Procesando...</p>
      </div>
    );
  }

  if (status === 'form' && mode === 'resetPassword') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
        <Logo />
        <div className="mx-auto w-full max-w-[350px] space-y-4">
          <h1 className="text-xl font-semibold text-center">Nueva contraseña</h1>
          {resetEmail && (
            <p className="text-muted-foreground text-sm text-center">
              Ingresá una nueva contraseña para <strong>{resetEmail}</strong>
            </p>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleResetPasswordSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Actualizar contraseña
              </Button>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <div className="mx-auto w-full max-w-[400px] space-y-4 text-center">
        {status === 'success' ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
        )}
        <p className="text-sm">{message}</p>
        <div className="flex flex-col gap-2 pt-2">
          {status === 'success' && (
            <Button onClick={redirectToApp} className="w-full">
              Ir al dashboard
            </Button>
          )}
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ActionHandlerContent />
    </Suspense>
  );
}
