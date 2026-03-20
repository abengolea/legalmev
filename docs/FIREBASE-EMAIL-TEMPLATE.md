# Emails de verificación - Resend

LegalMev usa **Resend** para enviar correos de verificación con diseño personalizado y un botón claro (en lugar del link largo de Firebase).

## Configuración

### Variables de entorno

En `.env.local` (local) o como secrets en Firebase App Hosting:

| Variable | Descripción |
|----------|-------------|
| `RESEND_API_KEY` | API key de [Resend](https://resend.com/api-keys) |
| `RESEND_FROM` | Remitente: `LegalMev <noreply@legalmev.com.ar>` o `onboarding@resend.dev` para pruebas |

### Crear secretos en Firebase

```bash
firebase apphosting:secrets:set RESEND_API_KEY
```

## Flujo

1. Usuario se registra → se llama a `/api/auth/send-verification-email`
2. Se genera un token, se guarda en Firestore (`verificationTokens`) y se envía el email vía Resend
3. El email tiene un **botón** "Verificar mi email" que apunta a `/api/verify-email?token=xxx`
4. Al hacer clic, se valida el token, se marca `emailVerified` en Firebase Auth y se redirige a `/auth/action?verified=1`

## Fallback

Si Resend no está configurado (`RESEND_API_KEY` vacío), el sistema usa Firebase `sendEmailVerification` como fallback. El correo tendrá el link largo por defecto, pero la verificación funcionará.

## Plantilla del email (Resend)

El diseño está en `src/app/api/auth/send-verification-email/route.ts` con colores de LegalMev (#2A6A78).
