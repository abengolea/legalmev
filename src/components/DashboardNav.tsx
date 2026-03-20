'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { LayoutDashboard, LogOut, Shield, Users, Building2, BarChart3, CreditCard, Settings, Landmark } from 'lucide-react';
import { Logo } from './Logo';
import { useSidebar } from '@/components/ui/sidebar';

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state } = useSidebar();
  const adminTab = pathname === '/admin' ? (searchParams.get('tab') || 'dashboard') : null;
  const [userData, setUserData] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [isColegioAdmin, setIsColegioAdmin] = useState(false);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubDoc?.();
      unsubDoc = undefined;
      setIsColegioAdmin(false);
      if (!user) return;
      user.getIdToken().then(() => {
        unsubDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            setUserData((snap.data() as { name?: string; email?: string; role?: string }) ?? null);
          },
          (err) => {
            console.warn('[DashboardNav] Firestore snapshot error:', err.message);
          }
        );
        user.getIdToken().then((token) => {
          fetch('/api/colegio/me', { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((j) => setIsColegioAdmin(!!j?.ok && !!j?.colegio))
            .catch(() => setIsColegioAdmin(false));
        });
      });
    });
    return () => {
      unsubAuth();
      unsubDoc?.();
    };
  }, []);

  const isActive = (path: string) => {
    return pathname.startsWith(path) && (path !== '/' || pathname === '/');
  };

  const initials = userData?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="text-sidebar-foreground">
          <Logo />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard')}
              icon={<LayoutDashboard />}
              tooltip={{ children: 'Panel' }}
            >
              <Link href="/dashboard">Panel</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isColegioAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/colegio')}
                icon={<Landmark />}
                tooltip={{ children: 'Mi colegio' }}
              >
                <Link href="/dashboard/colegio">Mi colegio</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {userData?.role === 'admin' && (
            <SidebarGroup>
              <SidebarGroupLabel>Administración</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin')}
                    icon={<Shield />}
                    tooltip={{ children: 'Admin' }}
                  >
                    <Link href="/admin">Admin</Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'dashboard'}>
                        <Link href="/admin?tab=dashboard"><LayoutDashboard className="size-4" /> Dashboard</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'users'}>
                        <Link href="/admin?tab=users"><Users className="size-4" /> Usuarios</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'colegios'}>
                        <Link href="/admin?tab=colegios"><Building2 className="size-4" /> Colegios</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'stats'}>
                        <Link href="/admin?tab=stats"><BarChart3 className="size-4" /> Estadísticas</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'payments'}>
                        <Link href="/admin?tab=payments"><CreditCard className="size-4" /> Pagos</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'config'}>
                        <Link href="/admin?tab=config&configTab=payments"><Settings className="size-4" /> Configuración</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-2 bg-sidebar-border" />
        <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                {state === 'expanded' && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-sidebar-foreground truncate">{userData?.name || 'Usuario'}</span>
                        <span className="text-xs text-muted-foreground truncate">{userData?.email || ''}</span>
                    </div>
                 )}
            </div>
            {state === 'expanded' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground shrink-0"
                  onClick={() => signOut(auth).then(() => router.push('/login'))}
                >
                  <LogOut size={16} />
                </Button>
            )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
