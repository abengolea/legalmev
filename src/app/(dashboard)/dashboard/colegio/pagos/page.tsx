import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminGuard } from '@/components/AdminGuard';
import { ColegioPagosAdminClient } from '@/components/ColegioPagosAdminClient';

export default function ColegioPagosPage() {
  return (
    <AdminGuard>
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <ColegioPagosAdminClient />
      </Suspense>
    </AdminGuard>
  );
}
