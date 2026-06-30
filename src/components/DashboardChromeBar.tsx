'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Logo } from './Logo';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/** Barra superior con toggle del sidebar (mobile + desktop). */
export function DashboardChromeBar() {
  const { state } = useSidebar();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b border-border/60',
        'bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80',
      )}
    >
      <SidebarTrigger className="h-8 w-8 shrink-0" title="Mostrar/ocultar menú (tecla B)" />
      <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
        <Logo className="min-w-0 [&_h1]:truncate [&_h1]:text-lg" />
      </div>
      <p className="hidden md:block text-xs text-muted-foreground truncate">
        {state === 'expanded' ? 'Menú expandido' : 'Menú compacto'}
        <span className="hidden lg:inline"> · tecla </span>
        <kbd className="hidden lg:inline rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">B</kbd>
      </p>
    </header>
  );
}
