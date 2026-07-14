'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
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
  SidebarMenuBadge,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { LayoutDashboard, LogOut, Shield, Users, Building2, BarChart3, CreditCard, Settings, Landmark, Receipt, Gavel, FileSearch } from 'lucide-react';
import { Logo } from './Logo';
import { useSidebar } from '@/components/ui/sidebar';

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const showSidebarDetails = state === 'expanded' || isMobile;
  const adminTab = pathname === '/admin' ? (searchParams.get('tab') || 'dashboard') : null;
  const [userData, setUserData] = useState<{
    name?: string;
    email?: string;
    role?: string;
    isPlatformAdmin?: boolean;
    canAccessControlPrueba?: boolean;
    controlPrueba?: { hasAccess?: boolean };
  } | null>(null);
  const [canAccessCopilot, setCanAccessCopilot] = useState(false);
  const [canUseControlPrueba, setCanUseControlPrueba] = useState(false);
  const [isColegioAdmin, setIsColegioAdmin] = useState(false);
  const [controlPruebaRiesgo, setControlPruebaRiesgo] = useState(0);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setIsColegioAdmin(false);
      if (!user) {
        setUserData(null);
        return;
      }
      user.getIdToken().then((token) => {
        fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((j) => {
            if (j?.ok && j.user) {
              setUserData(j.user);
              setIsColegioAdmin(!!j.user.isColegioAdmin);
              setCanAccessCopilot(!!j.user.audienciaCopilot?.hasAccess);
              setCanUseControlPrueba(
                !!j.user.canAccessControlPrueba || !!j.user.controlPrueba?.hasAccess,
              );
            } else {
              setUserData(null);
              setIsColegioAdmin(false);
              setCanAccessCopilot(false);
              setCanUseControlPrueba(false);
            }
          })
          .catch(() => {
            setUserData(null);
            setIsColegioAdmin(false);
            setCanAccessCopilot(false);
            setCanUseControlPrueba(false);
          });
      });
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!canUseControlPrueba) {
      setControlPruebaRiesgo(0);
      return;
    }

    let cancelled = false;

    const loadAlertas = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/control-prueba/alertas', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && data?.ok) {
          setControlPruebaRiesgo(Number(data.totalRiesgo) || 0);
        }
      } catch {
        if (!cancelled) setControlPruebaRiesgo(0);
      }
    };

    void loadAlertas();
    const interval = window.setInterval(loadAlertas, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canUseControlPrueba]);

  const isColegioOnly = isColegioAdmin && !userData?.isPlatformAdmin;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/';
    }
    return pathname.startsWith(path);
  };

  const initials = userData?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="text-sidebar-foreground">
          <Logo />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {isColegioOnly ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/dashboard/colegio'}
                  icon={<Landmark />}
                  tooltip={{ children: 'Mi colegio' }}
                >
                  <Link href="/dashboard/colegio">Mi colegio</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/dashboard/pagos')}
                  icon={<Receipt />}
                  tooltip={{ children: 'Pagos y facturas' }}
                >
                  <Link href="/dashboard/pagos">Pagos y facturas</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <>
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
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/pagos')}
              icon={<Receipt />}
              tooltip={{ children: 'Pagos y facturas' }}
            >
              <Link href="/dashboard/pagos">Pagos y facturas</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isColegioAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/dashboard/colegio'}
                  icon={<Landmark />}
                  tooltip={{ children: 'Mi colegio' }}
                >
                  <Link href="/dashboard/colegio">Mi colegio</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          )}
          {canAccessCopilot && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/copiloto-audiencias')}
                icon={<Gavel />}
                tooltip={{ children: 'Copiloto Audiencias' }}
              >
                <Link href="/dashboard/copiloto-audiencias">Copiloto Audiencias</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {canUseControlPrueba && (
            <SidebarMenuItem className="relative">
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/control-prueba')}
                icon={<FileSearch />}
                tooltip={{ children: 'Control de prueba' }}
              >
                <Link href="/dashboard/control-prueba">Control de prueba</Link>
              </SidebarMenuButton>
              {controlPruebaRiesgo > 0 && (
                <SidebarMenuBadge className="bg-red-500 text-white">
                  {controlPruebaRiesgo > 99 ? '99+' : controlPruebaRiesgo}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          )}
            </>
          )}
          {userData?.isPlatformAdmin && (
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
                      <SidebarMenuSubButton asChild isActive={adminTab === 'audiencias'}>
                        <Link href="/admin?tab=audiencias"><Gavel className="size-4" /> Uso Audiencias</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'pruebas'}>
                        <Link href="/admin?tab=pruebas"><FileSearch className="size-4" /> Uso Pruebas</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={adminTab === 'payments'}>
                        <Link href="/admin?tab=payments"><CreditCard className="size-4" /> Pagos</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/dashboard/colegio/pagos')}>
                        <Link href="/dashboard/colegio/pagos"><Receipt className="size-4" /> Cuotas colegio</Link>
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
                {showSidebarDetails && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-sidebar-foreground truncate">{userData?.name || 'Usuario'}</span>
                        <span className="text-xs text-muted-foreground truncate">{userData?.email || ''}</span>
                    </div>
                 )}
            </div>
            {showSidebarDetails && (
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
