'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const LEGALMEV_MSG_TYPE = 'LEGALMEV_AUTH_TOKEN';

/**
 * Página /extension-connect
 * Verifica sesión del usuario, obtiene Firebase ID Token y lo envía a la extensión
 * mediante postMessage. El content script de la extensión recibe y guarda el token.
 */

/** Obtiene un nombre amigable para el saludo (displayName, o primera parte del email) */
function getNombreSaludo(user: { displayName?: string | null; email?: string | null }): string {
  const base = user.displayName?.trim() || user.email?.split('@')[0] || 'usuario';
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

export default function ExtensionConnectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'sent' | 'redirect' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando sesión...');
  const [nombre, setNombre] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        const redirect = encodeURIComponent('/extension-connect');
        router.replace(`/login?redirect=${redirect}`);
        return;
      }

      if (!user.emailVerified) {
        router.replace('/verifica-email');
        return;
      }

      try {
        const token = await user.getIdToken(true);
        if (!token) {
          setStatus('error');
          setMessage('No se pudo obtener el token. Volvé a intentar.');
          return;
        }

        const baseUrl = window.location.origin;
        const nombreSaludo = getNombreSaludo(user);
        window.postMessage(
          { type: LEGALMEV_MSG_TYPE, token, baseUrl, nombre: nombreSaludo },
          baseUrl
        );

        setNombre(getNombreSaludo(user));
        setStatus('sent');
        setMessage('¡Cuenta conectada! Podés cerrar esta pestaña y volver a la extensión.');
      } catch (err) {
        console.error('Error obteniendo token:', err);
        setStatus('error');
        setMessage('Error al conectar. Volvé a intentar o iniciá sesión de nuevo.');
      }
    };

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        const redirect = encodeURIComponent('/extension-connect');
        router.replace(`/login?redirect=${redirect}`);
      } else if (!user.emailVerified) {
        router.replace('/verifica-email');
      } else {
        run();
      }
    });

    return () => unsub();
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
        <h1 className="text-xl font-semibold mb-2">¡Hola{nombre ? `, ${nombre}` : ''}!</h1>
        <p className="text-muted-foreground text-center mb-6">{message}</p>
        <Link
          href="/dashboard"
          className="text-sm text-primary hover:underline"
        >
          Ir al dashboard
        </Link>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <p className="text-destructive mb-4">{message}</p>
        <Link
          href="/login"
          className="text-sm text-primary hover:underline"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return null;
}
