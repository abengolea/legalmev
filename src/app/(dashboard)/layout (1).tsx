import { DashboardNav } from '@/components/DashboardNav';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <DashboardNav />
        <SidebarInset>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background">
                {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
