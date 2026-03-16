# Deploy en Firebase App Hosting

Este proyecto está configurado para **Firebase App Hosting** (no Vercel). Sigue estos pasos para desplegar.

## 1. Variables de entorno y secretos

Hay dos formas de configurarlas:

### Opción A: Firebase Console (rápida)

1. **Firebase Console** → **Build** → **App Hosting** → tu backend → **Settings** → **Environment**
2. Agregá todas las variables de `.env.example` con sus valores reales.
3. Para `FIREBASE_PRIVATE_KEY`: copiá el valor completo del JSON de la cuenta de servicio (con los `\n` literales).

### Opción B: apphosting.yaml + Secret Manager (recomendada para secretos)

Los secretos sensibles van en **Cloud Secret Manager**:

```bash
# Crear cada secreto (te pedirá el valor)
firebase apphosting:secrets:set FIREBASE_PRIVATE_KEY
# IMPORTANTE: App Hosting no permite vars que empiecen con FIREBASE_. Al agregar a apphosting.yaml, usá:
#   variable: APP_PROJECT_ID   (no FIREBASE_PROJECT_ID)
#   variable: APP_CLIENT_EMAIL
#   variable: APP_PRIVATE_KEY
#   variable: APP_STORAGE_BUCKET
firebase apphosting:secrets:set WHATSAPP_ACCESS_TOKEN
firebase apphosting:secrets:set GOOGLE_GENAI_API_KEY
```

Luego referenciarlos en `apphosting.yaml` (ya está la estructura comentada).

## 2. Variables necesarias

| Variable | Secreto | Dónde obtenerla |
|---------|---------|-----------------|
| `NEXT_PUBLIC_FIREBASE_*` | No | Firebase Console → Configuración del proyecto → Tus apps |
| `FIREBASE_PROJECT_ID` | No | `project_id` del JSON de la cuenta de servicio |
| `FIREBASE_CLIENT_EMAIL` | No | `client_email` del JSON |
| `FIREBASE_PRIVATE_KEY` | Sí | `private_key` del JSON (copiar exactamente, con `\n`) |
| `FIREBASE_STORAGE_BUCKET` | No | `{project_id}.appspot.com` |
| `GOOGLE_GENAI_API_KEY` | Sí | Google AI Studio / Vertex AI |
| `WHATSAPP_*` | Sí/No | Meta for Developers |

## 3. URL de tu app

Tras el deploy, la URL será algo como:

- `https://backends-XXXXX-YYY.web.app`
- O la que hayas configurado como dominio personalizado.

## 4. Extensión Chrome

En `mev_descarga/mev_exporter_ext/popup.js` cambiá:

```javascript
const API_BASE = 'https://TU-URL-DE-FIREBASE-APP-HOSTING';
```

por la URL real de tu backend.

## 5. Firebase Storage

Verificá que Firebase Storage esté habilitado para tu proyecto (requerido por `/api/export`):

- **Firebase Console** → **Build** → **Storage** → **Get started**
