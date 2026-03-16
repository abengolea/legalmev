
'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
import { Cpu, Database, Edit, Trash2, Users, CheckCircle, XCircle, FileText, Shield, MessageSquare, Bot, Send, PlusCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { clientIntakeAutomation } from '@/ai/flows/client-intake-automation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
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

  useEffect(() => {
    setIsLoading(true);
    const usersCollection = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(userList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Ver y gestionar todos los usuarios en el sistema.</CardDescription>
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
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


export default function AdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Panel de Administración</h1>
        <p className="text-muted-foreground">Gestiona usuarios, configuraciones y monitorea la salud del sistema.</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users"><Users className="mr-2"/> Usuarios</TabsTrigger>
          <TabsTrigger value="system"><Cpu className="mr-2"/> Sistema</TabsTrigger>
          <TabsTrigger value="logs"><FileText className="mr-2"/> Registros</TabsTrigger>
          <TabsTrigger value="ai-test"><Bot className="mr-2"/> Test IA</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
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
