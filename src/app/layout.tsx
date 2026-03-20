import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

// Evita prerender durante build cuando NEXT_PUBLIC_FIREBASE_* no están disponibles
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL.replace(/\/$/, '')),
  title: 'LegalMev',
  description: 'Sistema de gestión legal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`legalmev-rebrand ${inter.className}`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
