
'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cpu, Database, Users, XCircle, FileText, MessageSquare, Bot, Send, PlusCircle, Zap, CreditCard, BarChart3 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { clientIntakeAutomation } from '@/ai/flows/client-intake-automation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  tier?: 'free' | 'premium';
  freeDownloadsUsed?: number;
  downloadsThisMonth?: number;
  phone?: string;
};


const systemStatus = [
    { name: 'Servicio de API', status: 'Operacional', icon: <Cpu className="h-5 w-5 text-green-500" /> },
    { name: 'Conexión a Base de Datos', status: 'Operacional', icon: <Database className="h-5 w-5 text-green-500" /> },
    { name: 'Servicio de WhatsApp', status: 'Rendimiento Degradado', icon: <MessageSquare className="h-5 w-5 text-yellow-500" /> },
    { name: 'Servicio de Email', status: 'Interrupción', icon: <XCircle className="h-5 w-5 text-red-500" /> },
];

const mockLogs = `
[2023-10-27 10:00:00] INFO: Usuario 'ana.gomez@ejemplo.com' inició sesión correctamente.
[2023-10-27 10:01:15] INFO: Análisis del caso 'CASO001' completado. Probabilidad de éxito: 75%.
[2023-10-27 10:02:30] WARN: El servicio de WhatsApp responde lentamente. Latencia: 1500ms.
[2023-10-27 10:05:00] INFO: Usuario 'juan.perez@bufete.com' aceptó el caso 'CASO001'.
[2023-10-27 10:10:45] ERROR: No se pudo conectar al servicio de email. Conexión SMTP rechazada.
[2023-10-27 10:11:00] INFO: Cuenta del usuario 'carlos.t@ejemplo.com' bloqueada tras 5 intentos de inicio de sesión fallidos.
[2023-10-27 10:15:22] INFO: Nuevo caso 'CASO004' recibido de 'diana.p@ejemplo.com'.
[2023-10-27 10:16:00] INFO: Caso 'CASO004' rechazado automáticamente por bajo valor estimado ($15000).
`;

const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
        case 'activo':
            return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300">Activo</Badge>;
        case 'pendiente':
            return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300">Pendiente</Badge>;
        case 'inactivo':
            return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300 border-gray-300">Inactivo</Badge>;
        case 'bloqueado':
            return <Badge variant="destructive">Bloqueado</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

const getSystemStatusColor = (status: string) => {
    switch(status) {
        case 'Operacional':
            return 'text-green-500';
        case 'Rendimiento Degradado':
            return 'text-yellow-500';
        case 'Interrupción':
            return 'text-red-500';
        default:
            return 'text-muted-foreground';
    }
}

type Message = {
    role: 'user' | 'model';
    content: string;
};

function AITestChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [lawyerName, setLawyerName] = useState('Adrian Bengolea');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const conversationHistory = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            
            const result = await clientIntakeAutomation({
                lawyerName,
                message: input,
                conversationHistory,
            });

            const aiMessage: Message = { role: 'model', content: result.response };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Error calling AI:", error);
            const errorMessage: Message = { role: 'model', content: "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Test de IA Conversacional</CardTitle>
                <CardDescription>Simula una conversación con el asistente legal de IA.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 space-y-2">
                    <Label htmlFor="lawyer-name">Nombre del Abogado</Label>
                    <Input 
                        id="lawyer-name"
                        value={lawyerName} 
                        onChange={(e) => setLawyerName(e.target.value)}
                        placeholder="ej. Juan Pérez"
                    />
                </div>
                <div className="border rounded-lg h-[60vh] flex flex-col">
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        'flex items-start gap-3',
                                        message.role === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    {message.role === 'model' && (
                                        <Avatar className="w-8 h-8">
                                            <AvatarFallback><Bot size={16}/></AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            'rounded-lg px-3 py-2 text-sm max-w-md',
                                            message.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                        )}
                                    >
                                        {message.content}
                                    </div>
                                     {message.role === 'user' && (
                                        <Avatar className="w-8 h-8">
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                             {isLoading && (
                                <div className="flex items-start gap-3 justify-start">
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback><Bot size={16}/></AvatarFallback>
                                    </Avatar>
                                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                                        Escribiendo...
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-4 border-t">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe tu mensaje aquí..."
                                disabled={isLoading}
                                autoComplete="off"
                            />
                            <Button type="submit" disabled={isLoading || !input.trim()}>
                                <Send size={16} />
                            </Button>
                        </form>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const usersCollection = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const userList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setUsers(userList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpgradePremium = async (userId: string) => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        tier: 'premium',
        downloadsThisMonth: 0,
        monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      toast({ title: 'Usuario actualizado a Premium', description: '100 expedientes/mes disponibles.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar.' });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Asigná tier y gestioná descargas (5 free / 100 premium/mes). Los usuarios se verifican por email al registrarse.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <PlusCircle className="mr-2" />
            Crear Usuario
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Cargando usuarios...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    <Badge variant={user.tier === 'premium' ? 'default' : 'secondary'}>
                      {user.tier === 'premium' ? 'Premium' : 'Gratis'}
                    </Badge>
                    {user.tier === 'free' && user.status === 'activo' && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({user.freeDownloadsUsed ?? 0}/5)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {user.tier !== 'premium' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpgradePremium(user.id)}
                        disabled={updatingId === user.id}
                      >
                        <Zap className="h-4 w-4 mr-1" /> Premium
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsConfig() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    stripePublishableKey: '',
    premiumPriceId: '',
    premiumPriceAmount: 0,
    currency: 'ARS',
    contactEmail: 'contacto@legalmev.com',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/settings/payments', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.ok && json.settings) setSettings(json.settings);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.ok) toast({ title: 'Guardado', description: 'Configuración de pagos actualizada.' });
      else toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo guardar.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Cargando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Pagos</CardTitle>
        <CardDescription>Stripe y datos de contacto para solicitudes premium. Las claves secretas se configuran en variables de entorno.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="stripePk">Stripe Publishable Key</Label>
            <Input id="stripePk" value={settings.stripePublishableKey} onChange={(e) => setSettings((s) => ({ ...s, stripePublishableKey: e.target.value }))} placeholder="pk_live_..." />
          </div>
          <div>
            <Label htmlFor="priceId">Premium Price ID (Stripe)</Label>
            <Input id="priceId" value={settings.premiumPriceId} onChange={(e) => setSettings((s) => ({ ...s, premiumPriceId: e.target.value }))} placeholder="price_..." />
          </div>
          <div>
            <Label htmlFor="amount">Monto Premium (mostrar)</Label>
            <Input id="amount" type="number" value={settings.premiumPriceAmount || ''} onChange={(e) => setSettings((s) => ({ ...s, premiumPriceAmount: Number(e.target.value) || 0 }))} placeholder="9999" />
          </div>
          <div>
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} placeholder="ARS" />
          </div>
          <div>
            <Label htmlFor="contact">Email de contacto (premium)</Label>
            <Input id="contact" type="email" value={settings.contactEmail} onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))} placeholder="contacto@legalmev.com" />
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Stats() {
  const [stats, setStats] = useState<{
    totalUsers?: number;
    premiumUsers?: number;
    freeUsers?: number;
    totalExportaciones?: number;
    exportacionesEsteMes?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.ok && json.stats) setStats(json.stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void fetchStats();
  }, []);

  if (loading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!stats) return <p className="text-muted-foreground">No se pudieron cargar las estadísticas.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Usuarios totales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.totalUsers ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Usuarios Premium</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.premiumUsers ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Exportaciones totales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.totalExportaciones ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Exportaciones este mes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.exportacionesEsteMes ?? 0}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Panel de Administración</h1>
        <p className="text-muted-foreground">Gestiona usuarios, configuraciones y monitorea la salud del sistema.</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users"><Users className="mr-2"/> Usuarios</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="mr-2"/> Estadísticas</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="mr-2"/> Pagos</TabsTrigger>
          <TabsTrigger value="system"><Cpu className="mr-2"/> Sistema</TabsTrigger>
          <TabsTrigger value="logs"><FileText className="mr-2"/> Registros</TabsTrigger>
          <TabsTrigger value="ai-test"><Bot className="mr-2"/> Test IA</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="stats">
          <Stats />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsConfig />
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Estado del Sistema</CardTitle>
              <CardDescription>Un resumen de la salud de los componentes críticos del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                {systemStatus.map(service => (
                    <Card key={service.name}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base font-medium">{service.name}</CardTitle>
                            {service.icon}
                        </CardHeader>
                        <CardContent>
                            <p className={`text-2xl font-bold ${getSystemStatusColor(service.status)}`}>{service.status}</p>
                        </CardContent>
                    </Card>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
           <Card>
            <CardHeader>
              <CardTitle>Registros del Sistema</CardTitle>
              <CardDescription>Un feed en tiempo real de eventos y errores del sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                <Textarea readOnly value={mockLogs} className="h-96 bg-muted font-mono text-xs" />
            </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="ai-test">
            <AITestChat />
        </TabsContent>
      </Tabs>
    </div>
  );
}
