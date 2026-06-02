'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const COLEGIO_RESPONSABLE_HOME = '/dashboard/colegio';

function isAllowedPath(pathname: string): boolean {
  if (pathname === '/dashboard/colegio') return true;
  if (pathname === '/dashboard/pagos' || pathname.startsWith('/dashboard/pagos/')) return true;
  return false;
}

/**
 * Responsables de colegio solo administran su colegio: Mi colegio + Pagos y facturas.
 * Redirige el resto de rutas del dashboard (panel, settings, casos, etc.).
 */
export function ColegioResponsableGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [isColegioOnly, setIsColegioOnly] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setIsColegioOnly(false);
        setChecking(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const colegioOnly =
          !!json?.ok && !!json.user?.isColegioAdmin && !json.user?.isPlatformAdmin;
        setIsColegioOnly(colegioOnly);
      } catch {
        setIsColegioOnly(false);
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (checking || !isColegioOnly) return;
    if (!isAllowedPath(pathname)) {
      router.replace(COLEGIO_RESPONSABLE_HOME);
    }
  }, [checking, isColegioOnly, pathname, router]);

  if (checking) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isColegioOnly && !isAllowedPath(pathname)) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

export function useColegioResponsableOnly(): {
  loading: boolean;
  isColegioOnly: boolean;
} {
  const [loading, setLoading] = useState(true);
  const [isColegioOnly, setIsColegioOnly] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setIsColegioOnly(false);
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setIsColegioOnly(
          !!json?.ok && !!json.user?.isColegioAdmin && !json.user?.isPlatformAdmin
        );
      } catch {
        setIsColegioOnly(false);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return { loading, isColegioOnly };
}
