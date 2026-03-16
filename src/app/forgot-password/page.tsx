'use client';

import Link from 'next/link';
import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

const forgotSchema = z.object({
  email: z.string().email('El email no es válido'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotFormValues) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setSent(true);
      toast({
        title: 'Correo enviado',
        description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
      });
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      let description = 'No se pudo enviar el correo. Intenta de nuevo más tarde.';
      if (error.code === 'auth/user-not-found') {
        description = 'No existe una cuenta con este correo electrónico.';
      } else if (error.code === 'auth/invalid-email') {
        description = 'El correo electrónico no es válido.';
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto w-full max-w-[350px] space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold">Restablecer contraseña</h1>
          <p className="text-muted-foreground text-sm">
            Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm">
            <p className="text-muted-foreground">
              Si el correo existe en nuestra base de datos, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Link href="/login" className="mt-4 inline-block text-primary underline">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@ejemplo.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          </Form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          ¿Recordaste tu contraseña?{' '}
          <Link href="/login" className="underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
