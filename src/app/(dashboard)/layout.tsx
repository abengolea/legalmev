import { Inter } from 'next/font/google';
import { DashboardNav } from '@/components/DashboardNav';
import { DashboardAuthGuard } from '@/components/DashboardAuthGuard';
import { NotificasColegioPromoDialog } from '@/components/NotificasColegioPromoDialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { DashboardMobileBar } from '@/components/DashboardMobileBar';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthGuard>
      <NotificasColegioPromoDialog />
      <SidebarProvider>
        <div className={`legalmev-rebrand ${inter.className} flex min-h-screen`}>
          <DashboardNav />
          <SidebarInset>
            <DashboardMobileBar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </DashboardAuthGuard>
  );
}
