'use client';

import { PaymentHistoryClient } from '@/components/PaymentHistoryClient';
import { useColegioResponsableOnly } from '@/components/ColegioResponsableGuard';
import { Loader2 } from 'lucide-react';

export default function PagosPage() {
  const { loading, isColegioOnly } = useColegioResponsableOnly();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isColegioOnly) {
    return <PaymentHistoryClient variant="colegio" />;
  }

  return <PaymentHistoryClient variant="usuario" />;
}
