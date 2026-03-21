
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Cpu, Database, Users, XCircle, FileText, MessageSquare, Bot, Send, PlusCircle, Zap, CreditCard, BarChart3, Building2, Upload, AlertTriangle, Receipt, Link2, UserPlus, LayoutDashboard, TrendingUp, DollarSign, FileOutput, ArrowRight, Settings, Mail, MoreHorizontal, Ban, Unlock, RefreshCw, History, StickyNote } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { clientIntakeAutomation } from '@/ai/flows/client-intake-automation';
import { cn, safeResJson } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

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
  colegioId?: string | null;
  colegioName?: string | null;
  premiumSource?: 'payment' | 'colegio' | 'admin' | null;
  premiumForever?: boolean;
  adminNotes?: string | null;
};

type Exportacion = {
  id: string;
  expedienteNumero: string;
  cantidadActuaciones: number;
  caratula: string;
  juzgado: string;
  filename: string;
  creadoEn: string;
};

type Colegio = {
  id: string;
  name: string;
  convenioActivo: boolean;
  members?: { email: string; name: string }[];
  adminEmails?: string[];
  cuotaMensual?: number | null;
  montoConvenio?: number | null;
  moneda?: string;
  periodoFacturacion?: string;
  notas?: string;
  contactoFacturacion?: string;
  cuit?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterColegio, setFilterColegio] = useState<string>('all');
  const [exportacionesUserId, setExportacionesUserId] = useState<string | null>(null);
  const [exportaciones, setExportaciones] = useState<Exportacion[]>([]);
  const [exportacionesLoading, setExportacionesLoading] = useState(false);
  const [notesUserId, setNotesUserId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    import('@/lib/firebase').then(({ auth }) => {
      const unsub = auth.onAuthStateChanged((u) => setCurrentUserId(u?.uid ?? null));
      return () => unsub();
    });
  }, []);

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

  const handleSetPremium = async (userId: string, type: 'monthly' | 'forever') => {
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/premium`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type }),
      });
      const json = await safeResJson<{ ok?: boolean; message?: string; error?: string }>(res);
      if (json.ok) {
        toast({
          title: json.message ?? 'Premium asignado',
          description: type === 'monthly' ? '30 días con cuota mensual estándar' : 'Sin límite de descargas',
        });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo actualizar.' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevokePremium = async (userId: string) => {
    if (!confirm('¿Quitar el acceso premium a este usuario?')) return;
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/premium`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok?: boolean; message?: string; error?: string }>(res);
      if (json.ok) {
        toast({ title: 'Premium revocado', description: 'El usuario volvió a plan gratuito.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo revocar.' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo revocar.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeStatus = async (userId: string, newStatus: string) => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { status: newStatus });
      toast({ title: 'Estado actualizado', description: `Usuario pasado a ${newStatus}.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estado.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (userId === currentUserId) {
      toast({ variant: 'destructive', title: 'Error', description: 'No podés cambiar tu propio rol.' });
      return;
    }
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) toast({ title: 'Rol actualizado', description: `Ahora es ${newRole}.` });
      else toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo actualizar.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendVerification = async (userId: string) => {
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) toast({ title: 'Email enviado', description: 'Correo de verificación reenviado.' });
      else toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo enviar.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetDownloads = async (userId: string) => {
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/reset-downloads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'both' }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) toast({ title: 'Descargas reseteadas' });
      else toast({ variant: 'destructive', title: 'Error', description: json.error });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBlock = async (userId: string, disabled: boolean) => {
    if (userId === currentUserId) {
      toast({ variant: 'destructive', title: 'No podés bloquear tu propia cuenta.' });
      return;
    }
    if (!confirm(disabled ? '¿Bloquear esta cuenta? El usuario no podrá iniciar sesión.' : '¿Desbloquear esta cuenta?')) return;
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ disabled }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) toast({ title: disabled ? 'Cuenta bloqueada' : 'Cuenta desbloqueada' });
      else toast({ variant: 'destructive', title: 'Error', description: json.error });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const fetchExportaciones = async (userId: string) => {
    setExportacionesUserId(userId);
    setExportacionesLoading(true);
    setExportaciones([]);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}/exportaciones?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok?: boolean; exportaciones?: Exportacion[] }>(res);
      if (json.ok && json.exportaciones) setExportaciones(json.exportaciones);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las exportaciones.' });
    } finally {
      setExportacionesLoading(false);
    }
  };

  const handleSaveNotes = async (userId: string) => {
    setUpdatingId(userId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminNotes: notesValue }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) {
        toast({ title: 'Notas guardadas' });
        setNotesUserId(null);
      } else toast({ variant: 'destructive', title: 'Error', description: json.error });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error' });
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filterTier !== 'all' && (u.tier ?? 'free') !== filterTier) return false;
    if (filterStatus !== 'all' && (u.status || 'activo') !== filterStatus) return false;
    if (filterColegio !== 'all' && (u.colegioName ?? '') !== filterColegio) return false;
    return true;
  });

  const colegiosOptions = Array.from(new Set(users.map((u) => u.colegioName).filter(Boolean))) as string[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Asigná tier y gestioná descargas. La cuota premium (expedientes/mes) se configura en la pestaña Configuración.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <PlusCircle className="mr-2" />
            Crear Usuario
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoading && (
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Plan</Label>
              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="free">Gratis</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Colegio</Label>
              <Select value={filterColegio} onValueChange={setFilterColegio}>
                <SelectTrigger className="w-44 h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {colegiosOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredUsers.length} de {users.length} usuarios
            </span>
          </div>
        )}
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
                <TableHead>Colegio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {user.adminNotes && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <StickyNote className="h-4 w-4 text-amber-500 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs"><p className="whitespace-pre-wrap">{user.adminNotes}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {user.email}
                    </span>
                  </TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role || 'abogado'}
                      onValueChange={(v) => handleChangeRole(user.id, v)}
                      disabled={updatingId === user.id || user.id === currentUserId}
                    >
                      <SelectTrigger className="w-[100px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abogado">Abogado</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.status || 'activo'}
                      onValueChange={(v) => handleChangeStatus(user.id, v)}
                      disabled={updatingId === user.id}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="inactivo">Inactivo</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.tier === 'premium' ? 'default' : 'secondary'}>
                      {user.tier === 'premium' ? 'Premium' : 'Gratis'}
                    </Badge>
                    {user.tier === 'premium' && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {user.premiumSource === 'colegio' ? '(colegio)' : user.premiumSource === 'admin' ? (user.premiumForever ? '(admin, siempre)' : '(admin, 1 mes)') : '(pago)'}
                      </span>
                    )}
                    {user.tier === 'free' && user.status === 'activo' && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({user.freeDownloadsUsed ?? 0}/5)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{user.colegioName || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {user.tier !== 'premium' ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetPremium(user.id, 'monthly')}
                            disabled={updatingId === user.id}
                            title="Premium por 30 días"
                          >
                            <Zap className="h-4 w-4 mr-1" /> 1 mes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetPremium(user.id, 'forever')}
                            disabled={updatingId === user.id}
                            title="Premium permanente sin límite"
                          >
                            <Zap className="h-4 w-4 mr-1" /> Siempre
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevokePremium(user.id)}
                          disabled={updatingId === user.id}
                          title="Quitar acceso premium"
                        >
                          Quitar premium
                        </Button>
                      )}
                      {user.status === 'bloqueado' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBlock(user.id, false)}
                          disabled={updatingId === user.id || user.id === currentUserId}
                          title="Desbloquear cuenta"
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      ) : user.id !== currentUserId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive/80 hover:text-destructive"
                          onClick={() => handleBlock(user.id, true)}
                          disabled={updatingId === user.id}
                          title="Bloquear cuenta"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" disabled={updatingId === user.id}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setNotesUserId(user.id); setNotesValue(user.adminNotes ?? ''); }}>
                            <StickyNote className="h-4 w-4 mr-2" /> Notas admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => fetchExportaciones(user.id)}>
                            <History className="h-4 w-4 mr-2" /> Ver exportaciones
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResendVerification(user.id)}>
                            <Mail className="h-4 w-4 mr-2" /> Reenviar verificación
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetDownloads(user.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Resetear descargas
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Dialog open={!!exportacionesUserId} onOpenChange={(o) => !o && setExportacionesUserId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Exportaciones</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-[200px]">
              {exportacionesLoading ? (
                <p className="text-muted-foreground py-4">Cargando...</p>
              ) : exportaciones.length === 0 ? (
                <p className="text-muted-foreground py-4">Sin exportaciones</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Expediente</TableHead>
                      <TableHead>Actuaciones</TableHead>
                      <TableHead>Carátula</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportaciones.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">{e.creadoEn ? new Date(e.creadoEn).toLocaleString('es-AR') : '-'}</TableCell>
                        <TableCell>{e.expedienteNumero || '-'}</TableCell>
                        <TableCell>{e.cantidadActuaciones}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={e.caratula}>{e.caratula || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
        <Dialog open={!!notesUserId} onOpenChange={(o) => { if (!o) setNotesUserId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notas del admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Notas internas (solo visibles para admins)"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button
                onClick={() => notesUserId && handleSaveNotes(notesUserId)}
                disabled={updatingId === notesUserId}
              >
                {updatingId === notesUserId ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ResponsablesFicha() {
  const { toast } = useToast();
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColegioId, setSelectedColegioId] = useState('');
  const [emails, setEmails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchColegios = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/colegios', { headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; colegios?: Colegio[] }>(res);
      if (json.ok && json.colegios) {
        setColegios(json.colegios);
        if (!selectedColegioId && json.colegios.length) setSelectedColegioId(json.colegios[0].id);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); void fetchColegios(); }, []);

  const handleAlta = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emails.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!selectedColegioId || parsed.length === 0) {
      toast({ variant: 'destructive', title: 'Completá colegio y al menos un email' });
      return;
    }
    setSubmitting(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/colegios/invite-responsables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ colegioId: selectedColegioId, emails: parsed }),
      });
      const json = await safeResJson<{ ok?: boolean; added?: number; emailsSent?: number; emailsFailed?: string[]; message?: string }>(res);
      if (json.ok) {
        const desc = json.emailsSent
          ? `Agregados. ${json.emailsSent} correo(s) de invitación enviado(s) para crear/configurar contraseña.`
          : json.message || 'Responsables dados de alta.';
        if (json.emailsFailed?.length) {
          toast({
            title: 'Responsables dados de alta',
            description: `${desc} No se pudo enviar a: ${json.emailsFailed.join(', ')}`,
            variant: 'default',
          });
        } else {
          toast({ title: 'Responsables dados de alta', description: desc });
        }
        setEmails('');
        void fetchColegios();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: (json as { error?: string }).error ?? 'No se pudo agregar.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo dar de alta.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Cargando colegios...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Dar de alta responsables de colegio
        </CardTitle>
        <CardDescription>
          Agregá emails de personas que administrarán la lista de colegiados autorizados. Recibirán un correo para crear o configurar su contraseña. Luego podrán subir Excel/CSV y verán &quot;Mi colegio&quot; en el menú.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAlta} className="space-y-4 max-w-xl">
          <div>
            <Label htmlFor="colegio-select">Colegio</Label>
            <Select value={selectedColegioId} onValueChange={setSelectedColegioId}>
              <SelectTrigger id="colegio-select" className="mt-1">
                <SelectValue placeholder="Seleccioná un colegio" />
              </SelectTrigger>
              <SelectContent>
                {colegios.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="emails-input">Emails del responsable (o varios separados por coma)</Label>
            <Input
              id="emails-input"
              type="text"
              placeholder="secretaria@colegio.com, admin@colegio.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={submitting || !selectedColegioId || !emails.trim()}>
            {submitting ? 'Agregando...' : 'Dar de alta'}
          </Button>
        </form>
        {colegios.some((c) => (c.adminEmails?.length ?? 0) > 0) && (
          <div className="border-t pt-6 mt-6">
            <h4 className="font-medium mb-3">Responsables actuales por colegio</h4>
            <div className="space-y-2 text-sm">
              {colegios.filter((c) => (c.adminEmails?.length ?? 0) > 0).map((c) => (
                <div key={c.id} className="flex gap-4 items-center">
                  <span className="font-medium text-muted-foreground min-w-[200px]">{c.name}</span>
                  <span>{(c.adminEmails || []).join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ColegiosManagement() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreateLink = async (colegioId: string, metodo: 'mercadopago' | 'dlocal') => {
    const key = `${colegioId}:${metodo}`;
    setGeneratingLink(key);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/payments/create-colegio-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ colegioId, metodo }),
      });
      const json = await safeResJson<{ ok?: boolean; link?: string; error?: string }>(res);
      if (json.ok && json.link) {
        await navigator.clipboard.writeText(json.link);
        toast({ title: 'Link copiado', description: `Link de ${metodo === 'mercadopago' ? 'Mercado Pago' : 'DLocal'} copiado al portapapeles.` });
        window.open(json.link, '_blank');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo generar el link.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el link.' });
    } finally {
      setGeneratingLink(null);
    }
  };

  const fetchColegios = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/colegios', { headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; colegios?: Colegio[] }>(res);
      if (json.ok && json.colegios) setColegios(json.colegios);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); void fetchColegios(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const adminEmails = newAdminEmails
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch('/api/admin/colegios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), adminEmails }),
      });
      const json = await safeResJson(res);
      if (json.ok) { toast({ title: 'Colegio creado', description: `"${newName}" agregado.` }); setNewName(''); setNewAdminEmails(''); void fetchColegios(); }
      else toast({ variant: 'destructive', title: 'Error', description: (json as { error?: string }).error ?? 'No se pudo crear.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear.' }); }
    finally { setCreating(false); }
  };

  const handleUpload = async (colegioId: string, file: File) => {
    setUploadingId(colegioId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/admin/colegios/${colegioId}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const json = await safeResJson<{ ok?: boolean; message?: string }>(res);
      if (json.ok) { toast({ title: 'Excel procesado', description: json.message }); void fetchColegios(); }
      else toast({ variant: 'destructive', title: 'Error', description: (json as { error?: string }).error ?? 'Error al subir.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'Error al subir.' }); }
    finally { setUploadingId(null); }
  };

  const [newAdminEmails, setNewAdminEmails] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { cuotaMensual: string; montoConvenio: string; moneda: string; periodoFacturacion: string; notas: string; contactoFacturacion: string; cuit: string; adminEmails: string }>>({});

  const getDefaults = (colegio: Colegio) => ({
    cuotaMensual: colegio.cuotaMensual != null ? String(colegio.cuotaMensual) : '',
    montoConvenio: colegio.montoConvenio != null ? String(colegio.montoConvenio) : '',
    moneda: colegio.moneda ?? 'ARS',
    periodoFacturacion: colegio.periodoFacturacion ?? 'mensual',
    notas: colegio.notas ?? '',
    contactoFacturacion: colegio.contactoFacturacion ?? '',
    cuit: colegio.cuit ?? '',
    adminEmails: (colegio.adminEmails || []).join(', '),
  });
  const getEditValues = (c: Colegio) => editValues[c.id] ?? getDefaults(c);

  const handleUpdateColegio = async (colegioId: string, values: { cuotaMensual?: number | null; montoConvenio?: number | null; moneda?: string; periodoFacturacion?: string; notas?: string; contactoFacturacion?: string; cuit?: string; adminEmails?: string }) => {
    setUpdatingId(colegioId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const body: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (values.cuotaMensual !== undefined) body.cuotaMensual = values.cuotaMensual;
      if (values.montoConvenio !== undefined) body.montoConvenio = values.montoConvenio;
      if (values.moneda !== undefined) body.moneda = values.moneda;
      if (values.periodoFacturacion !== undefined) body.periodoFacturacion = values.periodoFacturacion;
      if (values.notas !== undefined) body.notas = values.notas;
      if (values.contactoFacturacion !== undefined) body.contactoFacturacion = values.contactoFacturacion;
      if (values.cuit !== undefined) body.cuit = values.cuit?.trim() ? values.cuit.replace(/\D/g, '') : '';
      if (values.adminEmails !== undefined) {
        body.adminEmails = values.adminEmails
          .split(/[,;\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
      }

      const res = await fetch(`/api/admin/colegios/${colegioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await safeResJson(res);
      if (json.ok) { toast({ title: 'Configuración guardada' }); void fetchColegios(); setEditValues((s) => { const n = { ...s }; delete n[colegioId]; return n; }); }
      else toast({ variant: 'destructive', title: 'Error', description: (json as { error?: string }).error ?? 'No se pudo actualizar.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar.' }); }
    finally { setUpdatingId(null); }
  };

  const handleSuspender = async (colegioId: string) => {
    if (!confirm('¿Suspender el convenio? Todos los miembros perderán el acceso premium de inmediato.')) return;
    setSuspendingId(colegioId);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/colegios/${colegioId}/suspender`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; message?: string }>(res);
      if (json.ok) { toast({ title: 'Convenio suspendido', description: json.message }); void fetchColegios(); }
      else toast({ variant: 'destructive', title: 'Error', description: (json as { error?: string }).error ?? 'No se pudo suspender.' });
    } catch { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo suspender.' }); }
    finally { setSuspendingId(null); }
  };

  if (loading) return <p className="text-muted-foreground">Cargando colegios...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convenios con Colegios</CardTitle>
        <CardDescription>Creá colegios, asigná admins (emails) para que auto-administren la lista. Subí Excel/CSV (emails + nombres) para dar premium automático. Si se corta el convenio, podés suspender a todos de una vez.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCreate} className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Nombre del colegio (ej. Colegio de Abogados de CABA)" value={newName} onChange={(e) => setNewName(e.target.value)} className="min-w-[200px]" />
            <Button type="submit" disabled={creating || !newName.trim()}>{creating ? 'Creando...' : 'Crear colegio'}</Button>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Emails de administradores del colegio (opcional)</Label>
            <Input
              placeholder="admin@colegio.com, otro@colegio.com — podrán subir la lista de autorizados"
              value={newAdminEmails}
              onChange={(e) => setNewAdminEmails(e.target.value)}
              className="mt-1"
            />
          </div>
        </form>
        <div className="space-y-6">
          {colegios.length === 0 ? <p className="text-muted-foreground">No hay colegios. Creá uno y subí el Excel.</p> : colegios.map((c) => {
            const ev = getEditValues(c);
            return (
            <div key={c.id} className="border rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {c.name}
                    <Badge variant={c.convenioActivo ? 'default' : 'secondary'}>{c.convenioActivo ? 'Activo' : 'Suspendido'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {c.members?.length ?? 0} miembros en lista · Si se registran obtienen premium automático
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.convenioActivo && (
                    <>
                      <label className="cursor-pointer">
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(c.id, f); e.target.value = ''; }} />
                        <Button type="button" variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" /> Subir Excel/CSV</span></Button>
                      </label>
                      {(c.montoConvenio != null && Number(c.montoConvenio) > 0) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateLink(c.id, 'mercadopago')}
                            disabled={generatingLink !== null}
                          >
                            {generatingLink === `${c.id}:mercadopago` ? (
                              '...'
                            ) : (
                              <><Link2 className="h-4 w-4 mr-1" /> Link MP</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateLink(c.id, 'dlocal')}
                            disabled={generatingLink !== null}
                          >
                            {generatingLink === `${c.id}:dlocal` ? (
                              '...'
                            ) : (
                              <><Link2 className="h-4 w-4 mr-1" /> Link DLocal</>
                            )}
                          </Button>
                        </>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => handleSuspender(c.id)} disabled={suspendingId === c.id}><AlertTriangle className="h-4 w-4 mr-1" /> Suspender</Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t pt-4">
                <div>
                  <Label className="text-xs font-medium">Monto a cobrar ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ej. 50000"
                    value={ev.montoConvenio}
                    onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), montoConvenio: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Moneda</Label>
                  <Select value={ev.moneda} onValueChange={(v) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), moneda: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Período facturación</Label>
                  <Select value={ev.periodoFacturacion} onValueChange={(v) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), periodoFacturacion: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Cuota expedientes/miembro</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Global"
                    value={ev.cuotaMensual}
                    onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), cuotaMensual: e.target.value } }))}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Vacío = usa cuota global</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label className="text-xs font-medium">CUIT (para facturación)</Label>
                  <Input
                    placeholder="20-12345678-9 o 11 dígitos"
                    value={ev.cuit}
                    onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), cuit: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Contacto facturación</Label>
                  <Input
                    placeholder="Email o teléfono"
                    value={ev.contactoFacturacion}
                    onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), contactoFacturacion: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Notas</Label>
                  <Input
                    placeholder="Observaciones del convenio"
                    value={ev.notas}
                    onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), notas: e.target.value } }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium">Admins del colegio (emails)</Label>
                <Input
                  placeholder="admin@colegio.com, otro@colegio.com — pueden subir lista de autorizados"
                  value={ev.adminEmails}
                  onChange={(e) => setEditValues((s) => ({ ...s, [c.id]: { ...getDefaults(c), ...(s[c.id] ?? {}), adminEmails: e.target.value } }))}
                />
                <p className="text-xs text-muted-foreground mt-0.5">Los admins verán &quot;Mi colegio&quot; en el menú y podrán subir Excel/CSV.</p>
              </div>
              <Button
                size="sm"
                disabled={updatingId === c.id}
                onClick={() => {
                  const ev2 = getEditValues(c);
                  handleUpdateColegio(c.id, {
                    montoConvenio: ev2.montoConvenio === '' ? null : Math.max(0, Number(ev2.montoConvenio) || 0),
                    moneda: ev2.moneda,
                    periodoFacturacion: ev2.periodoFacturacion,
                    cuotaMensual: ev2.cuotaMensual === '' ? null : Math.max(0, Number(ev2.cuotaMensual) || 0),
                    notas: ev2.notas,
                    contactoFacturacion: ev2.contactoFacturacion,
                    cuit: ev2.cuit,
                    adminEmails: ev2.adminEmails,
                  });
                }}
              >
                {updatingId === c.id ? 'Guardando...' : 'Guardar configuración'}
              </Button>
            </div>
          );})}
        </div>
      </CardContent>
    </Card>
  );
}

function ColegiosSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const colegioSubParam = searchParams.get('colegioSub');
  const activeSub = (VALID_COLEGIO_SUB.includes(colegioSubParam as typeof VALID_COLEGIO_SUB[number]) ? colegioSubParam : 'convenios') as typeof VALID_COLEGIO_SUB[number];

  const setSub = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'colegios');
    params.set('colegioSub', value);
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <Tabs value={activeSub} onValueChange={setSub} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="convenios"><Building2 className="mr-2 h-4 w-4" /> Convenios</TabsTrigger>
        <TabsTrigger value="responsables"><UserPlus className="mr-2 h-4 w-4" /> Responsables</TabsTrigger>
      </TabsList>
      <TabsContent value="convenios">
        <ColegiosManagement />
      </TabsContent>
      <TabsContent value="responsables">
        <ResponsablesFicha />
      </TabsContent>
    </Tabs>
  );
}

function ResendTestCard() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; from: string | null } | null>(null);

  const fetchStatus = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings/test-resend', { headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; configured?: boolean; from?: string | null }>(res);
      if (json.ok) {
        setStatus({ configured: json.configured ?? false, from: json.from ?? null });
        if (!email && user.email) setEmail(user.email);
      }
    } catch (e) {
      console.error(e);
      setStatus({ configured: false, from: null });
    }
  };

  useEffect(() => { void fetchStatus(); }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings/test-resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await safeResJson<{ ok?: boolean; error?: string; message?: string }>(res);
      if (json.ok) {
        toast({ title: 'Enviado', description: json.message ?? `Correo enviado a ${email}` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo enviar' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el correo de prueba.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Prueba de Resend</CardTitle>
          <CardDescription>Enviá un correo de prueba para verificar que Resend (emails de verificación, invitaciones) está funcionando. Variables: RESEND_API_KEY y RESEND_FROM en .env.local</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== null && (
            <div className={cn(
              'rounded-lg border p-3 text-sm',
              status.configured
                ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/50 bg-amber-950/20 text-amber-700 dark:text-amber-300'
            )}>
              {status.configured ? (
                <>
                  <p className="font-medium">Resend configurado correctamente</p>
                  <p className="text-muted-foreground mt-1">Remitente: <code className="text-primary">{status.from ?? '—'}</code></p>
                </>
              ) : (
                <p>Resend no está configurado. Agregá RESEND_API_KEY y RESEND_FROM a .env.local</p>
              )}
            </div>
          )}
          <form onSubmit={handleSend} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-64">
              <Label htmlFor="resend-test-email">Enviar prueba a</Label>
              <Input
                id="resend-test-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>
            <Button type="submit" disabled={sending || !status?.configured}>
              {sending ? 'Enviando...' : (
                <> <Send className="mr-2 h-4 w-4" /> Enviar correo de prueba</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsConfig() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    stripePublishableKey: '',
    premiumPriceId: '',
    premiumPriceAmount: 0,
    premiumQuotaPerMonth: 100,
    currency: 'ARS',
    contactEmail: 'contacto@legalmev.com',
    mercadopagoPublicKey: '',
    dlocalSubscriptionLink: '',
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
        const json = await safeResJson<{ ok?: boolean; settings?: Record<string, unknown> }>(res);
        if (json.ok && json.settings) {
          const s = json.settings as Record<string, unknown>;
          setSettings({
            stripePublishableKey: (s.stripePublishableKey as string) ?? '',
            premiumPriceId: (s.premiumPriceId as string) ?? '',
            premiumPriceAmount: (s.premiumPriceAmount as number) ?? 0,
            premiumQuotaPerMonth: (s.premiumQuotaPerMonth as number) ?? 100,
            currency: (s.currency as string) ?? 'ARS',
            contactEmail: (s.contactEmail as string) ?? 'contacto@legalmev.com',
            mercadopagoPublicKey: (s.mercadopagoPublicKey as string) ?? '',
            dlocalSubscriptionLink: (s.dlocalSubscriptionLink as string) ?? '',
          });
        }
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
      const json = await safeResJson(res);
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
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Pagos</CardTitle>
        <CardDescription>Mercado Pago, Stripe y datos de contacto para el plan premium. El Access Token de Mercado Pago se configura en variables de entorno (MERCADOPAGO_ACCESS_TOKEN).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-lg border border-teal-500/30 bg-teal-950/10 p-4 space-y-2">
            <h4 className="font-medium">DLocal Go - Suscripción abogado particular</h4>
            <div>
              <Label htmlFor="dlocalLink">Link de suscripción mensual (checkout.dlocalgo.com)</Label>
              <Input id="dlocalLink" value={settings.dlocalSubscriptionLink} onChange={(e) => setSettings((s) => ({ ...s, dlocalSubscriptionLink: e.target.value }))} placeholder="https://checkout.dlocalgo.com/validate/subscription/..." />
              <p className="text-xs text-muted-foreground mt-1">Link creado en el panel de DLocal para cobro recurrente mensual. Si existe, el botón &quot;Pagar con DLocal&quot; redirige aquí (se pasa user_reference=uid).</p>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-2">
            <h4 className="font-medium">Mercado Pago</h4>
            <div>
              <Label htmlFor="mpPk">Public Key (puede ser TEST-... o APP_USR-...)</Label>
              <Input id="mpPk" value={settings.mercadopagoPublicKey} onChange={(e) => setSettings((s) => ({ ...s, mercadopagoPublicKey: e.target.value }))} placeholder="APP_USR-xxxx o TEST-xxxx" />
              <p className="text-xs text-muted-foreground mt-1">Access Token: configurarlo en .env como MERCADOPAGO_ACCESS_TOKEN (nunca en esta interfaz).</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Stripe (opcional, si querés mantenerlo)</div>
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
            <Label htmlFor="premiumQuota">Cuota Premium (expedientes/mes)</Label>
            <Input id="premiumQuota" type="number" min={1} value={settings.premiumQuotaPerMonth ?? 100} onChange={(e) => setSettings((s) => ({ ...s, premiumQuotaPerMonth: Math.max(1, Number(e.target.value) || 100) }))} placeholder="100" />
            <p className="text-xs text-muted-foreground mt-1">Cantidad máxima de expedientes que puede exportar un usuario premium por mes.</p>
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
    </div>
  );
}

function PagosControl() {
  const { toast } = useToast();
  const [pagos, setPagos] = useState<{ id: string; tipo?: string; monto?: number; moneda?: string; metodo?: string; estado?: string; clienteId?: string; colegioId?: string; colegioName?: string; descripcion?: string; createdAt?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [manualTipo, setManualTipo] = useState<'cliente' | 'colegio'>('colegio');
  const [manualMonto, setManualMonto] = useState('');
  const [manualColegioId, setManualColegioId] = useState('');
  const [manualColegioName, setManualColegioName] = useState('');
  const [manualPeriodo, setManualPeriodo] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [colegios, setColegios] = useState<{ id: string; name: string }[]>([]);

  const fetchPagos = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const url = tipoFilter === 'all' ? '/api/admin/pagos' : `/api/admin/pagos?tipo=${tipoFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; pagos?: { id: string; tipo?: string; monto?: number; moneda?: string; metodo?: string; estado?: string; clienteId?: string; colegioId?: string; colegioName?: string; descripcion?: string; createdAt?: string }[] }>(res);
      if (json.ok && json.pagos) setPagos(json.pagos);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchColegios = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/colegios', { headers: { Authorization: `Bearer ${token}` } });
      const json = await safeResJson<{ ok?: boolean; colegios?: { id: string; name: string }[] }>(res);
      if (json.ok && json.colegios) setColegios(json.colegios.map((c) => ({ id: c.id, name: c.name })));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { setLoading(true); void fetchPagos(); }, [tipoFilter]);
  useEffect(() => { void fetchColegios(); }, []);

  const handleManualPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const monto = Number(manualMonto);
    if (isNaN(monto) || monto <= 0) { toast({ variant: 'destructive', title: 'Monto inválido' }); return; }
    if (manualTipo === 'colegio' && !manualColegioId && !manualColegioName) { toast({ variant: 'destructive', title: 'Indicá colegio' }); return; }
    setSubmitting(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const body: Record<string, unknown> = { tipo: manualTipo, monto, metodo: 'manual', descripcion: manualDesc || (manualTipo === 'colegio' ? 'Cuota convenio' : 'Pago manual') };
      if (manualTipo === 'colegio') {
        if (manualColegioId) body.colegioId = manualColegioId;
        if (manualColegioName) body.colegioName = manualColegioName;
        if (manualPeriodo) body.periodo = manualPeriodo;
      }
      const res = await fetch('/api/admin/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await safeResJson(res);
      if (json.ok) { toast({ title: 'Pago registrado' }); setManualMonto(''); setManualDesc(''); setManualPeriodo(''); void fetchPagos(); }
      else toast({ variant: 'destructive', title: 'Error', description: json.error });
    } catch { toast({ variant: 'destructive', title: 'Error' }); }
    finally { setSubmitting(false); }
  };

  const formatDate = (s?: string) => s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Control de Pagos</CardTitle>
        <CardDescription>Pagos de clientes (MP/DLocal) y colegios. Podés registrar pagos manuales (transferencia, convenio).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2 items-center">
          <Label>Filtrar:</Label>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="colegio">Colegios</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6}>Cargando...</TableCell></TableRow> :
                pagos.length === 0 ? <TableRow><TableCell colSpan={6}>No hay pagos</TableCell></TableRow> :
                pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                    <TableCell><Badge variant="outline">{p.tipo ?? '-'}</Badge></TableCell>
                    <TableCell>${(p.monto ?? 0).toLocaleString()} {p.moneda ?? 'ARS'}</TableCell>
                    <TableCell>{p.metodo ?? '-'}</TableCell>
                    <TableCell>{p.tipo === 'colegio' ? (p.colegioName ?? p.colegioId ?? '-') : (p.clienteId ? 'Usuario' : '-')}</TableCell>
                    <TableCell><Badge variant={p.estado === 'completado' ? 'default' : 'secondary'}>{p.estado ?? '-'}</Badge></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t pt-6">
          <h4 className="font-medium mb-3">Registrar pago manual (colegio / transferencia)</h4>
          <form onSubmit={handleManualPago} className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Tipo</Label>
              <Select value={manualTipo} onValueChange={(v) => setManualTipo(v as 'cliente' | 'colegio')}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="colegio">Colegio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" min={1} value={manualMonto} onChange={(e) => setManualMonto(e.target.value)} placeholder="9999" className="w-24" />
            </div>
            {manualTipo === 'colegio' && (
              <>
                <div>
                  <Label>Colegio</Label>
                  <Select value={manualColegioId} onValueChange={(v) => { setManualColegioId(v); const c = colegios.find(x => x.id === v); if (c) setManualColegioName(c.name); }}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {colegios.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Período (ej. 2025-03)</Label>
                  <Input value={manualPeriodo} onChange={(e) => setManualPeriodo(e.target.value)} placeholder="2025-03" className="w-28" />
                </div>
              </>
            )}
            <div>
              <Label>Descripción</Label>
              <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Cuota mensual" className="w-40" />
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? '...' : 'Registrar'}</Button>
          </form>
        </div>
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
        const json = await safeResJson<{ ok?: boolean; stats?: { totalUsers?: number; premiumUsers?: number; freeUsers?: number; totalExportaciones?: number; exportacionesEsteMes?: number } }>(res);
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

type DashboardStats = {
  totalUsers?: number;
  premiumUsers?: number;
  freeUsers?: number;
  totalExportaciones?: number;
  exportacionesEsteMes?: number;
  totalColegios?: number;
  colegiosConConvenioActivo?: number;
  ingresosEsteMes?: number;
  ingresosTotales?: number;
  exportacionesPorDia?: { dia: string; count: number }[];
  ultimosPagos?: { id: string; monto: number; moneda: string; tipo: string; estado: string; colegioName?: string; createdAt?: string }[];
};

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { auth } = await import('@/lib/firebase');
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
        const json = await safeResJson<{ ok?: boolean; stats?: DashboardStats }>(res);
        if (json.ok && json.stats) setStats(json.stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void fetchStats();
  }, []);

  const formatMoney = (n: number, moneda = 'ARS') =>
    `$${n.toLocaleString('es-AR')} ${moneda}`;
  const formatDate = (s?: string) =>
    s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-muted-foreground">No se pudieron cargar los datos del dashboard.</p>;
  }

  const kpiCards = [
    { label: 'Usuarios', value: stats.totalUsers ?? 0, icon: Users, color: 'text-primary', bg: 'bg-primary/10', href: '?tab=users' },
    { label: 'Premium', value: stats.premiumUsers ?? 0, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-500/10', href: '?tab=users' },
    { label: 'Colegios con convenio', value: stats.colegiosConConvenioActivo ?? 0, icon: Building2, color: 'text-[#2A6A78]', bg: 'bg-[#54A6A8]/15', href: '?tab=colegios' },
    { label: 'Exportaciones (mes)', value: stats.exportacionesEsteMes ?? 0, icon: FileOutput, color: 'text-accent', bg: 'bg-accent/10', href: '?tab=stats' },
    { label: 'Ingresos (mes)', value: formatMoney(stats.ingresosEsteMes ?? 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10', href: '?tab=payments' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={`/admin${href}`}>
            <Card className="group h-full border-border/80 transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className={cn('mt-1 text-2xl font-bold tracking-tight', typeof value === 'number' ? '' : 'text-lg')}>
                      {value}
                    </p>
                  </div>
                  <div className={cn('rounded-lg p-2.5', bg, color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <span>Ver más</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Exportaciones últimos 7 días
            </CardTitle>
            <CardDescription>Actividad de exportación por día</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              {stats.exportacionesPorDia && stats.exportacionesPorDia.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.exportacionesPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Exportaciones" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Sin datos de exportaciones
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Últimos pagos
              </CardTitle>
              <CardDescription>Actividad reciente de cobros</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin?tab=payments">
                Ver todos
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.ultimosPagos && stats.ultimosPagos.length > 0 ? (
              <div className="space-y-3">
                {stats.ultimosPagos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={p.estado === 'completado' ? 'default' : 'secondary'}>{p.tipo}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {p.colegioName || 'Cliente'}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(p.monto, p.moneda)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay pagos recientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Accesos rápidos</h3>
              <p className="text-sm text-muted-foreground">Gestioná usuarios, colegios y configuración</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/admin?tab=users"><Users className="mr-2 h-4 w-4" /> Usuarios</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin?tab=colegios"><Building2 className="mr-2 h-4 w-4" /> Colegios</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin?tab=payments"><CreditCard className="mr-2 h-4 w-4" /> Pagos</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin?tab=config&configTab=payments"><Settings className="mr-2 h-4 w-4" /> Configuración</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/users/new"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo usuario</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const VALID_TABS = ['dashboard', 'users', 'colegios', 'stats', 'payments', 'config'] as const;
const VALID_COLEGIO_SUB = ['convenios', 'responsables'] as const;
const VALID_CONFIG_TABS = ['payments', 'email', 'system', 'logs', 'ai-test'] as const;

function ConfigTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const configTabParam = searchParams.get('configTab');
  const activeConfigTab = (VALID_CONFIG_TABS.includes(configTabParam as typeof VALID_CONFIG_TABS[number]) ? configTabParam : 'payments') as typeof VALID_CONFIG_TABS[number];

  const setConfigTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'config');
    params.set('configTab', value);
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <Tabs value={activeConfigTab} onValueChange={setConfigTab} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="payments"><CreditCard className="mr-2 h-4 w-4"/> Pagos</TabsTrigger>
        <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4"/> Email (Resend)</TabsTrigger>
        <TabsTrigger value="system"><Cpu className="mr-2 h-4 w-4"/> Sistema</TabsTrigger>
        <TabsTrigger value="logs"><FileText className="mr-2 h-4 w-4"/> Registros</TabsTrigger>
        <TabsTrigger value="ai-test"><Bot className="mr-2 h-4 w-4"/> Test IA</TabsTrigger>
      </TabsList>

      <TabsContent value="payments">
        <PaymentsConfig />
      </TabsContent>

      <TabsContent value="email">
        <ResendTestCard />
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
  );
}

function AdminTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const activeTab = (VALID_TABS.includes(tabParam as typeof VALID_TABS[number]) ? tabParam : 'dashboard') as typeof VALID_TABS[number];

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={setTab} className="w-full">
      <TabsList className="flex w-full flex-wrap gap-1">
        <TabsTrigger value="dashboard"><LayoutDashboard className="mr-2"/> Dashboard</TabsTrigger>
        <TabsTrigger value="users"><Users className="mr-2"/> Usuarios</TabsTrigger>
        <TabsTrigger value="colegios"><Building2 className="mr-2"/> Colegios</TabsTrigger>
        <TabsTrigger value="stats"><BarChart3 className="mr-2"/> Estadísticas</TabsTrigger>
        <TabsTrigger value="payments"><CreditCard className="mr-2"/> Pagos</TabsTrigger>
        <TabsTrigger value="config"><Settings className="mr-2"/> Configuración</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        <AdminDashboard />
      </TabsContent>

      <TabsContent value="users">
        <UserManagement />
      </TabsContent>

      <TabsContent value="colegios">
        <ColegiosSection />
      </TabsContent>


      <TabsContent value="stats">
        <Stats />
      </TabsContent>

      <TabsContent value="payments">
        <PagosControl />
      </TabsContent>

      <TabsContent value="config">
        <ConfigTabs />
      </TabsContent>
    </Tabs>
  );
}

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Panel de Administración</h1>
        <p className="text-muted-foreground">Gestiona usuarios, configuraciones y monitorea la salud del sistema.</p>
      </div>

      <AdminTabs />
    </div>
  );
}
