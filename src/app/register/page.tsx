
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Logo } from '@/components/Logo';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { safeResJson } from '@/lib/utils';

const registerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('El email no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  cuit: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const prefilledEmail = searchParams.get('email') || '';
  const isInvite = searchParams.get('invite') === 'colegio';

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: prefilledEmail,
      password: '',
      cuit: '',
    },
  });

  useEffect(() => {
    if (prefilledEmail) form.setValue('email', prefilledEmail);
  }, [prefilledEmail, form]);

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      // Step 1: Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Step 2: Save the user's profile information in Firestore
      const cuitClean = (data.cuit ?? '').replace(/\D/g, '');
      await setDoc(doc(db, 'users', user.uid), {
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        role: 'abogado',
        status: 'activo',
        tier: 'free',
        freeDownloadsUsed: 0,
        phone: '',
        cuit: cuitClean || '',
      });

      // Step 3: Enviar email de verificación. Resend (botón bonito) o Firebase como fallback
      const token = await user.getIdToken();
      const emailRes = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!emailRes.ok) {
        // Fallback: Firebase (link largo, pero funciona sin configurar Resend)
        await sendEmailVerification(user);
      }

      // Step 4: Si el email está en un colegio con convenio, asignar premium automáticamente
      try {
        const res = await fetch('/api/user/check-colegio', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await safeResJson<{ ok?: boolean; premiumFromColegio?: boolean; colegioName?: string }>(res);
        if (json.ok && json.premiumFromColegio) {
          toast({
            title: '¡Cuenta creada!',
            description: `Revisá tu correo y hacé clic en el link para verificar. Tu colegio "${json.colegioName}" tiene convenio.`,
          });
        } else {
          toast({
            title: '¡Cuenta creada!',
            description: 'Te enviamos un correo. Hacé clic en el link para verificar tu email y activar tu cuenta.',
          });
        }
      } catch {
        toast({
          title: '¡Cuenta creada!',
          description: 'Te enviamos un correo. Hacé clic en el link para verificar tu email y activar tu cuenta.',
        });
      }
      router.push('/verifica-email');
    } catch (error: any) {
      console.error('Error creating user:', error);
      let description = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Este correo electrónico ya está en uso por otra cuenta.';
        form.setError('email', {
          type: 'manual',
          message: 'Este correo electrónico ya está registrado.',
        });
      }
      toast({
        variant: 'destructive',
        title: 'Error en el Registro',
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader>
            <Logo />
            <CardTitle className="text-2xl font-headline mt-4">Crear cuenta</CardTitle>
            <CardDescription>
              {isInvite
                ? 'Completá tus datos para crear tu cuenta como responsable de colegio.'
                : 'Creá tu cuenta para solicitar acceso a la exportación de expedientes (MEV/PJN) a PDF.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="m@ejemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cuit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CUIT/CUIL (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="20-12345678-9 o 11 dígitos" {...field} />
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
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creando cuenta...' : 'Crear una cuenta'}
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="underline">
                Inicia sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/1200/900"
          alt="Image"
          width="1920"
          height="1080"
          data-ai-hint="modern courthouse"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}
