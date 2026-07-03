import type {NextConfig} from 'next';
import path from 'path';

const PDF_TRACE_PACKAGES = [
  './node_modules/pdf-parse/**/*',
  './node_modules/pdfjs-dist/**/*',
  './node_modules/@napi-rs/canvas/**/*',
  './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
  './node_modules/@napi-rs/canvas-linux-x64-musl/**/*',
  './node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*',
  './node_modules/@napi-rs/canvas-linux-arm64-musl/**/*',
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/admin/control-prueba/extract-pdf': PDF_TRACE_PACKAGES,
    '/api/admin/audiencia-copilot/load-expediente': PDF_TRACE_PACKAGES,
    '/api/admin/audiencia-copilot/sessions/[id]/documentos-adicionales': PDF_TRACE_PACKAGES,
  },
  // App Hosting / `next build`: errores de lint/TS legacy; corregir aparte.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [{ source: '/soporte', destination: '/landing/soporte' }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
