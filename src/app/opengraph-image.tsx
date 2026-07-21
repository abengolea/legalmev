import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'LegalMev — Exportá expedientes judiciales a PDF';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #1a3d47 0%, #1e4a55 45%, #2A6A78 100%)',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 28,
            color: '#7ec8ca',
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          Extensión Chrome · Abogados Argentina
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: '#54A6A8',
          }}
        >
          LegalMev
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.25,
            maxWidth: 920,
            color: '#e2e8f0',
          }}
        >
          Exportá expedientes judiciales a PDF
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 24,
            color: '#94a3b8',
            maxWidth: 900,
          }}
        >
          MEV SCBA · PJN · MPBA · Salta · Entre Ríos · Tucumán
        </div>
      </div>
    ),
    { ...size }
  );
}
