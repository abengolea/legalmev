
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Terminal, ShieldCheck, ShieldAlert, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateUserCredentials, getUserCredentials } from './actions';
import { monitorMev } from '@/ai/flows/monitor-mev-flow';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  cuit: z.string().optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, startSaveTransition] = useTransition();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', cuit: '' },
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } });
        const json = await safeResJson<{ ok?: boolean; user?: { name?: string; email?: string; cuit?: string } }>(res);
        if (json.ok && json.user) {
          form.reset({ name: json.user.name ?? '', cuit: json.user.cuit ?? '' });
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [form]);

  const onSubmit = (data: ProfileFormValues) => {
    startSaveTransition(async () => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('No autenticado');
        const token = await user.getIdToken();
        const cuitClean = (data.cuit ?? '').trim().replace(/\D/g, '');
        const res = await fetch('/api/user/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: data.name.trim(), cuit: cuitClean || '' }),
        });
        const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
        if (json.ok) toast({ title: 'Guardado', description: 'Perfil actualizado.' });
        else toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo guardar.' });
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil Profesional</CardTitle>
        <CardDescription>Actualiza tu información para pagos y facturación.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre" {...field} />
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
                  <FormLabel>CUIT/CUIL (para facturación)</FormLabel>
                  <FormControl>
                    <Input placeholder="20-12345678-9 o 11 dígitos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

const judicialCredentialsSchema = z.object({
    mevUser: z.string().optional(),
    mevPassword: z.string().optional(),
    pjnUser: z.string().optional(),
    pjnPassword: z.string().optional(),
});

type JudicialCredentialsFormValues = z.infer<typeof judicialCredentialsSchema>;

function JudicialIntegrationsForm() {
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();
    const [isTesting, startTestTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<JudicialCredentialsFormValues>({
        resolver: zodResolver(judicialCredentialsSchema),
        defaultValues: {
            mevUser: '',
            mevPassword: '',
            pjnUser: '',
            pjnPassword: '',
        }
    });

    useEffect(() => {
        setIsLoading(true);
        getUserCredentials().then(credentials => {
            if (credentials) {
                form.reset(credentials);
            } else {
                // If no credentials are found, reset with default empty values.
                form.reset({
                    mevUser: '',
                    mevPassword: '',
                    pjnUser: '',
                    pjnPassword: '',
                });
            }
        }).finally(() => setIsLoading(false));
    }, [form]);

    const onSubmit = (data: JudicialCredentialsFormValues) => {
        startSaveTransition(async () => {
            // Filter out empty password fields so they don't overwrite existing ones
            const credentialsToSave: any = { ...data };
            if (!data.mevPassword) delete credentialsToSave.mevPassword;
            if (!data.pjnPassword) delete credentialsToSave.pjnPassword;

            const result = await updateUserCredentials(credentialsToSave);
            if (result.success) {
                toast({
                    title: 'Éxito',
                    description: result.message,
                });
                // After saving, we don't want to show the password back
                form.reset({ ...data, mevPassword: '', pjnPassword: '' });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.message,
                });
            }
        });
    }

    const onTestConnection = async () => {
        const { mevUser, mevPassword } = form.getValues();
        if (!mevUser || !mevPassword) {
            toast({
                variant: 'destructive',
                title: 'Faltan Credenciales',
                description: 'Por favor, ingrese un usuario y una nueva contraseña para la MEV antes de probar la conexión.',
            });
            return;
        }

        startTestTransition(async () => {
            try {
                const result = await monitorMev({
                    username: mevUser,
                    password: mevPassword,
                });
                if (result.status === 'success') {
                    toast({
                        title: 'Prueba Exitosa',
                        description: result.message,
                    });
                } else {
                     toast({
                        variant: 'destructive',
                        title: 'Prueba Fallida',
                        description: result.message,
                    });
                }
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Error en la Prueba',
                    description: 'Ocurrió un error inesperado al probar la conexión.',
                });
                console.error("Error testing MEV connection:", error);
            }
        });
    }
    
    if (isLoading) {
        return (
             <CardContent>
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                    <p className="ml-2 text-muted-foreground">Cargando credenciales...</p>
                </div>
            </CardContent>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>Integraciones Judiciales</CardTitle>
                    <CardDescription>Conecta el sistema a las mesas de entradas virtuales para el monitoreo automático de expedientes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                      <ShieldCheck className="h-4 w-4 !text-blue-600" />
                      <AlertTitle className="text-blue-800 dark:text-blue-300">Almacenamiento Seguro</AlertTitle>
                      <AlertDescription className="text-blue-700 dark:text-blue-400">
                        Tus credenciales se almacenan de forma segura y nunca se exponen en el lado del cliente. Deja el campo de contraseña en blanco si no deseas actualizarla.
                      </AlertDescription>
                    </Alert>

                    {/* MEV SCBA */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">MEV - SCBA (Prov. de Buenos Aires)</h3>
                        <FormField
                            control={form.control}
                            name="mevUser"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Usuario</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Tu usuario de la MEV" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="mevPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contraseña</FormLabel>
                                    <FormControl>
                                        <PasswordInput placeholder="Ingresa una nueva contraseña para actualizar" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* PJN */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">PJN (Poder Judicial de la Nación)</h3>
                         <FormField
                            control={form.control}
                            name="pjnUser"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>CUIT/CUIL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Tu CUIT/CUIL" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="pjnPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contraseña</FormLabel>
                                    <FormControl>
                                        <PasswordInput placeholder="Ingresa una nueva contraseña para actualizar" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div className="flex items-center gap-2">
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSaving ? 'Guardando...' : 'Guardar Credenciales'}
                        </Button>
                        <Button variant="outline" type="button" onClick={onTestConnection} disabled={isTesting}>
                           {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                           {isTesting ? 'Probando...' : <><Zap className="mr-2"/> Probar Conexión MEV</>}
                        </Button>
                    </div>
                  <p className="text-xs text-muted-foreground">Se añadirán más jurisdicciones en el futuro.</p>
                </CardFooter>
            </form>
        </Form>
    )
}


export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'profile';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/api/whatsapp`;
      setWebhookUrl(url);
    }
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Configuración</h1>
        <p className="text-muted-foreground">Gestiona tu cuenta, integraciones y filtros de casos.</p>
      </div>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones Judiciales</TabsTrigger>
          <TabsTrigger value="filters">Filtros de Casos</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>Integración con WhatsApp</CardTitle>
              <CardDescription>Configura tu conexión con la API de WhatsApp Business.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">ID de tu Número de Teléfono</Label>
                <Input id="whatsapp-number" placeholder="Ej: 112233445566778" />
                 <p className="text-sm text-muted-foreground">Pega aquí el ID de tu número de teléfono de la API de WhatsApp.</p>
              </div>
               <div className="space-y-2">
                <Label htmlFor="whatsapp-token">Token de Acceso</Label>
                <PasswordInput id="whatsapp-token" placeholder="Pega aquí tu token de acceso permanente"/>
              </div>
                <div className="space-y-2">
                <Label htmlFor="verify-token">Token de Verificación</Label>
                <Input id="verify-token" placeholder="Crea y pega aquí un token de verificación secreto"/>
                 <p className="text-sm text-muted-foreground">Crea una cadena de texto segura. La necesitarás para configurar el webhook.</p>
              </div>
              <Separator/>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">URL del Webhook</Label>
                <Input id="webhook-url" value={webhookUrl} readOnly />
                <p className="text-sm text-muted-foreground">Configura esta URL en los ajustes de tu aplicación de WhatsApp en Meta for Developers.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="whatsapp-active" defaultChecked />
                <Label htmlFor="whatsapp-active">Activar integración con WhatsApp</Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Guardar Configuración de WhatsApp</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
            <Card>
                <JudicialIntegrationsForm />
            </Card>
        </TabsContent>


        <TabsContent value="filters">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Filtros de Casos</CardTitle>
              <CardDescription>Establece reglas para filtrar automáticamente los casos entrantes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="case-types">Tipos de Casos Aceptados</Label>
                <Input id="case-types" defaultValue="Divorcio, Lesiones Personales, Derecho Laboral" placeholder="ej. Divorcio, Accidente"/>
                <p className="text-sm text-muted-foreground">Lista de tipos de caso que manejas, separados por comas.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-value">Valor Mínimo del Caso</Label>
                <Input id="min-value" type="number" defaultValue="50000" />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="auto-reject" />
                <Label htmlFor="auto-reject">Rechazar automáticamente los casos que no cumplan los criterios</Label>
              </div>
              <Separator />
               <div className="space-y-2">
                <Label htmlFor="custom-questions">Preguntas Iniciales Personalizadas</Label>
                <Textarea id="custom-questions" placeholder="ej. ¿Le han ofrecido un acuerdo?" className="min-h-24"/>
                <p className="text-sm text-muted-foreground">Añade preguntas personalizadas para que la IA las haga a los clientes. Una pregunta por línea.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Guardar Filtros</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
