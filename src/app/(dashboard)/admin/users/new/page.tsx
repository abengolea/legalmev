
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El email no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  phone: z.string().optional(),
  role: z.enum(['abogado', 'admin'], {
    required_error: 'El rol es requerido',
  }),
  status: z.enum(['activo', 'inactivo'], {
    required_error: 'El estado es requerido',
  }),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'abogado',
      status: 'activo',
    },
  });

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      const fullPhoneNumber = data.phone ? `+549${data.phone}` : '';

      await setDoc(doc(db, 'users', user.uid), {
        name: data.name,
        email: data.email,
        phone: fullPhoneNumber,
        role: data.role,
        status: data.status,
      });

      toast({
        title: 'Usuario Creado',
        description: `El usuario ${data.name} ha sido creado exitosamente.`,
      });
      router.push('/admin');
    } catch (error: any) {
      console.error('Error creating user:', error);
      let description = 'Ocurrió un error inesperado.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Este correo electrónico ya está en uso. Por favor, utilice otro.';
        form.setError('email', {
            type: 'manual',
            message: 'Este correo electrónico ya está registrado.',
        });
      }
      toast({
        variant: 'destructive',
        title: 'Error al Crear Usuario',
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
       <div>
          <Button variant="outline" size="sm" asChild>
              <Link href="/admin"><ArrowLeft size={16} className="mr-2"/> Volver a Admin</Link>
          </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Usuario</CardTitle>
          <CardDescription>Complete el formulario para agregar un nuevo abogado al sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Juan Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                        <Input type="email" placeholder="Ej. juan.perez@bufete.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Teléfono (WhatsApp)</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-auto items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                              +549
                            </div>
                            <Input placeholder="1112345678" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Rol</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleccione un rol" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="abogado">Abogado</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleccione un estado" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
