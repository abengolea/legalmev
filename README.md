# LegalMev

Sistema para exportar expedientes judiciales desde MEV (Mesa de Entradas Virtual) y PJN (Poder Judicial de la Nación) a PDF. Incluye extensión Chrome, dashboard web y plan premium con convenios para colegios de abogados.

## Stack

- **Frontend**: Next.js 15, React 18, Tailwind CSS, Radix UI, shadcn/ui
- **Backend**: Next.js API Routes, Firebase (Auth, Firestore, Storage)
- **Pagos**: Mercado Pago (factura automática vía NotificasHub / Notificas S.R.L.)
- **IA**: Genkit (Google AI) para flujos de intake y análisis

## Requisitos

- Node.js 20+
- npm o pnpm

## Variables de entorno

Crea `.env.local` en la raíz con:

```env
# Firebase (cliente)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (servidor)
APP_PROJECT_ID=          # o FIREBASE_PROJECT_ID
APP_CLIENT_EMAIL=        # o FIREBASE_CLIENT_EMAIL
APP_PRIVATE_KEY=         # o FIREBASE_PRIVATE_KEY
APP_STORAGE_BUCKET=      # o FIREBASE_STORAGE_BUCKET

# Alternativa: archivo de credenciales
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

# Sitio
NEXT_PUBLIC_SITE_URL=https://www.legalmev.com.ar

# Pagos (opcional)
MERCADOPAGO_ACCESS_TOKEN=
DLOCAL_X_LOGIN=
DLOCAL_X_TRANS_KEY=
```

## Desarrollo

```bash
npm install
npm run dev
```

La app corre en [http://localhost:9007](http://localhost:9007).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack, puerto 9007) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Ejecutar ESLint |
| `npm run typecheck` | Verificar tipos TypeScript |
| `npm run create-admin` | Crear usuario administrador |
| `npm run check-env` | Inspeccionar variables de entorno |
| `npm run deploy` | Desplegar (Firebase) |

## Extensión Chrome

La extensión está en `mev_descarga/mev_exporter_ext/`. Soporta:

- MEV SCBA (Buenos Aires)
- Portal PJN (Nación)
- MPBA (Ministerio Público)

Instalá la extensión en Chrome, conectala con tu cuenta en legalmev.com.ar y exportá expedientes a PDF desde los portales judiciales.

## Despliegue

```bash
npm run deploy
```

Usa Firebase App Hosting. Requiere `firebase.json` y credenciales configuradas.

## Estructura relevante

```
src/
├── app/                    # Rutas Next.js (App Router)
│   ├── (dashboard)/        # Panel de usuario
│   ├── api/               # API Routes
│   ├── landing/           # Landing pública
│   └── auth/              # Acciones de auth
├── components/             # Componentes React
├── lib/                    # Utilidades, Firebase, etc.
├── ai/                     # Flujos Genkit (IA)
└── types/                  # Tipos TypeScript
```

## Licencia

Privado — Notificas SRL
