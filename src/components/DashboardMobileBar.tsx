'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Logo } from './Logo';

export function DashboardMobileBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden">
      <SidebarTrigger className="h-9 w-9 shrink-0" />
      <Logo className="min-w-0 [&_h1]:truncate [&_h1]:text-lg" />
    </header>
  );
}
