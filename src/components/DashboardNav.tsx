'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { LayoutDashboard, LogOut, Shield } from 'lucide-react';
import { Logo } from './Logo';
import { useSidebar } from '@/components/ui/sidebar';

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();
  const [userData, setUserData] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const unsubDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        setUserData((snap.data() as { name?: string; email?: string; role?: string }) ?? null);
      });
      return () => unsubDoc();
    });
    return () => unsubAuth();
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
          {userData?.role === 'admin' && (
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
