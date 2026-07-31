
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getDeviceId } from '@/lib/deviceId';
import { resolvePostLoginPath } from '@/lib/post-login-redirect';
import { fetchCheckColegio } from '@/lib/check-colegio-client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FileSearch, Gavel } from 'lucide-react';
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { SUPPORTED_PORTALS_LOGIN_EXTENSION } from '@/lib/supported-portals';

const loginSchema = z.object({
  email: z.string().email('El email no es válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      // Registrar este dispositivo como el único autorizado (evita compartir cuenta)
      const token = await user.getIdToken(true);
      const deviceId = getDeviceId();
      await fetch('/api/auth/claim-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId }),
      }).catch(() => {}); // No bloquear si falla
      await fetchCheckColegio(token);
      toast({
        title: '¡Bienvenido de nuevo!',
      });
      const dest = await resolvePostLoginPath(token, redirectTo);
      router.push(dest);
    } catch (error: any) {
      console.error('Error signing in:', error);
      let description = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'El correo electrónico o la contraseña son incorrectos.';
      } else if (error.code === 'auth/network-request-failed' || error.code === 'auth/invalid-api-key') {
        description = 'Revisa tu conexión y la configuración de Firebase (variables de entorno).';
      }
      toast({
        variant: 'destructive',
        title: 'Error al Iniciar Sesión',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const token = await user.getIdToken(true);
      const deviceId = getDeviceId();
      await fetch('/api/auth/claim-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId }),
      }).catch(() => {});
      await fetchCheckColegio(token);
      toast({ title: '¡Bienvenido de nuevo!' });
      const dest = await resolvePostLoginPath(token, redirectTo);
      window.location.href = dest;
      return;
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      console.error('Error signing in with Google:', error);
      let description = 'No se pudo iniciar sesión con Google. Intentá de nuevo.';
      if (error.code === 'auth/popup-blocked') {
        description = 'El navegador bloqueó la ventana. Permití ventanas emergentes para este sitio.';
      } else if (error.code === 'auth/network-request-failed' || error.code === 'auth/invalid-api-key') {
        description = 'Revisá tu conexión y la configuración de Firebase.';
      }
      toast({ variant: 'destructive', title: 'Error al Iniciar Sesión', description });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-full max-w-[400px] gap-6 px-4 sm:px-0">
          <div className="grid gap-2 text-center">
            <div className="flex justify-center">
              <Logo />
            </div>
            {redirectTo === '/extension-connect' ? (
              <p className="text-balance text-muted-foreground">
                {SUPPORTED_PORTALS_LOGIN_EXTENSION}
              </p>
            ) : (
              <p className="text-balance text-muted-foreground">Introduce tu email para iniciar sesión en tu cuenta</p>
            )}
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5 p-4 text-left shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Nuevo — fase de prueba
                  </p>
                  <p className="font-semibold text-foreground leading-snug">
                    Probá el Copiloto de Audiencias
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Asistente con IA para audiencias: sugerencias en vivo, contradicciones y alegatos.
                    Al entrar, tenés{' '}
                    <strong className="text-foreground">1 audiencia de prueba incluida</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5 p-4 text-left shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <FileSearch className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Etapa beta
                  </p>
                  <p className="font-semibold text-foreground leading-snug">
                    Probá el Control de pruebas
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Armá y seguí el control del expediente con IA: plazos, diligencias y subprocesos.
                    Tu cuenta incluye{' '}
                    <strong className="text-foreground">5 controles de prueba gratis</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel>Contraseña</FormLabel>
                      <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </Form>
           <Button variant="outline" type="button" className="w-full" onClick={onGoogleSignIn} disabled={isGoogleLoading}>
              {isGoogleLoading ? 'Conectando...' : 'Iniciar Sesión con Google'}
            </Button>
          <div className="mt-4 text-center text-sm">
            ¿No tienes una cuenta?{' '}
            <Link href="/register" className="underline">
              Regístrate
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/1200/900"
          alt="Image"
          width="1920"
          height="1080"
          data-ai-hint="law office"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
