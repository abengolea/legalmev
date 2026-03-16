import { Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, productName = 'LegalMev' }: { className?: string; productName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Gavel className="h-6 w-6 text-primary" />
      <h1 className="text-xl font-bold font-headline text-inherit">{productName}</h1>
    </div>
  );
}
