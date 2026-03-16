'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { LayoutDashboard, Gavel, Settings, LogOut, ChevronRight, Briefcase, Shield } from 'lucide-react';
import { Logo } from './Logo';
import { useSidebar } from '@/components/ui/sidebar';

export function DashboardNav() {
  const pathname = usePathname();
  const { state } = useSidebar();

  const isActive = (path: string) => {
    return pathname.startsWith(path) && (path !== '/' || pathname === '/');
  };

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
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/cases')} 
              icon={<Briefcase />}
              tooltip={{ children: 'Casos' }}
            >
              <Link href="/cases">Casos</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/admin')} 
              icon={<Shield />}
              tooltip={{ children: 'Admin' }}
            >
              <Link href="/admin">Admin</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/settings')} 
              icon={<Settings />}
              tooltip={{ children: 'Configuración' }}
            >
              <Link href="/settings">Configuración</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="my-2 bg-sidebar-border" />
        <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src="https://picsum.photos/40/40" alt="@abogado" data-ai-hint="professional headshot" />
                    <AvatarFallback>JP</AvatarFallback>
                </Avatar>
                {state === 'expanded' && (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-sidebar-foreground">Juan Pérez</span>
                        <span className="text-xs text-muted-foreground">juan.perez@bufete.com</span>
                    </div>
                 )}
            </div>
            {state === 'expanded' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground" asChild>
                    <Link href="/login"><LogOut size={16} /></Link>
                </Button>
            )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
