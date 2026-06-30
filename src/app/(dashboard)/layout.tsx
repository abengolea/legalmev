import { Inter } from 'next/font/google';
import type { CSSProperties } from 'react';
import { DashboardNav } from '@/components/DashboardNav';
import { DashboardAuthGuard } from '@/components/DashboardAuthGuard';
import { ColegioResponsableGuard } from '@/components/ColegioResponsableGuard';
import { NotificasColegioPromoDialog } from '@/components/NotificasColegioPromoDialog';
import { CopilotoAudienciaAnnouncementDialog } from '@/components/CopilotoAudienciaAnnouncementDialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardChromeBar } from '@/components/DashboardChromeBar';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthGuard>
      <ColegioResponsableGuard>
      <NotificasColegioPromoDialog />
      <CopilotoAudienciaAnnouncementDialog />
      <SidebarProvider
        style={
          {
            '--sidebar-width': '13rem',
            '--sidebar-width-icon': '2.75rem',
          } as CSSProperties
        }
      >
        <div className={`legalmev-rebrand ${inter.className} flex min-h-screen w-full min-w-0`}>
          <DashboardNav />
          <SidebarInset className="min-w-0">
            <DashboardChromeBar />
            <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-5 bg-background">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
      </ColegioResponsableGuard>
    </DashboardAuthGuard>
  );
}
