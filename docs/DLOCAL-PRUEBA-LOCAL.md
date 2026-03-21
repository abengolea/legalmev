# DLocal Go – Local y Producción

## Producción (checklist)

Para que DLocal funcione en **producción**:

1. **Credenciales LIVE** – Entrá a https://dashboard.dlocalgo.com → Integrations → API Integration y copiá API Key y Secret Key (no las de sandbox).
2. **Secrets en Firebase** – Ejecutá:
   ```bash
   firebase apphosting:secrets:set DLOCAL_API_KEY
   firebase apphosting:secrets:set DLOCAL_SECRET_KEY
   ```
   Pegá las credenciales LIVE cuando las pida.
3. **apphosting.yaml** – Ya incluye `DLOCAL_BASE_URL=https://api.dlocalgo.com` y las URLs de webhook/return para legalmev.com.ar. Si tu dominio es otro, cambiá `DLOCAL_WEBHOOK_URL` y `DLOCAL_RETURN_URL`.
4. **Redesplegar** – Después de setear secrets, hacé un nuevo deploy.

---

## Probar DLocal en local con ngrok

Para probar pagos con DLocal en desarrollo, necesitás exponer tu localhost porque **DLocal tiene que llamar a nuestro webhook** cuando el pago cambia de estado, y sus servidores no pueden alcanzar `localhost`.

## Pasos

### 1. Instalar ngrok

**Opción A – npx (sin instalar):**
```bash
npx ngrok http 9002
```

**Opción B – Instalación global:**
```bash
npm install -g ngrok
ngrok http 9002
```

Si es la primera vez, registrate en [ngrok.com](https://ngrok.com) (plan gratuito) y configurá tu auth token:
```bash
ngrok config add-authtoken TU_TOKEN
```

---

### 2. Dejar ngrok corriendo

Al iniciar ngrok deberías ver algo como:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:9002
```

Copiá la URL `https://...ngrok-free.app` (o `.ngrok.io`).

---

### 3. Configurar `.env.local`

**Solo para entorno local / pruebas.** En producción se usan otras URLs y credenciales.

Agregá o actualizá estas variables en `.env.local` (reemplazá `https://TU-URL.ngrok-free.app` con tu URL real de ngrok):

```env
# === DLocal - SOLO PARA DESARROLLO LOCAL (sandbox) ===
# En producción: api.dlocalgo.com y credenciales live
DLOCAL_BASE_URL=https://api-sbx.dlocalgo.com
DLOCAL_API_KEY=tu-api-key-sandbox
DLOCAL_SECRET_KEY=tu-secret-sandbox

# Webhook: DLocal postea aquí cuando cambia el estado del pago. DEBE ser una URL pública.
# En local necesitás ngrok porque localhost no es accesible desde los servidores de DLocal.
DLOCAL_WEBHOOK_URL=https://TU-URL.ngrok-free.app/api/payments/webhook-dlocal

# Opcional: vuelta después del pago. Por defecto usa localhost:9002 y suele ser correcto.
# DLOCAL_RETURN_URL=http://localhost:9002/dashboard?dlocal=success
```

---

### 4. Ejecutar la app y ngrok

**Terminal 1** – ngrok:
```bash
npx ngrok http 9002
```

**Terminal 2** – Next.js:
```bash
npm run dev
```

---

### 5. Flujo de prueba

1. Entrá a `http://localhost:9002`
2. Iniciá sesión
3. Andá al dashboard y hacé clic en "Pagar con DLocal"
4. Completá el pago en el checkout de DLocal (sandbox)
5. DLocal te redirige a `localhost:9002/dashboard?dlocal=success`
6. DLocal envía el webhook a `DLOCAL_WEBHOOK_URL` para actualizar el estado del pago

---

## Script rápido (opcional)

Si querés, podés agregar en `package.json`:

```json
"scripts": {
  "tunnel": "npx ngrok http 9002"
}
```

Y ejecutar `npm run tunnel` en una terminal aparte.

---

## Notas

- **Solo desarrollo local:** Las variables de esta guía (`DLOCAL_BASE_URL` sandbox, `DLOCAL_WEBHOOK_URL` con ngrok, credenciales sandbox) son para pruebas locales. En staging/producción usá `api.dlocalgo.com`, credenciales live y la URL real del sitio.
- **URL de ngrok:** En el plan gratuito la URL cambia cada vez que reiniciás ngrok. Tenés que actualizar `DLOCAL_WEBHOOK_URL` en `.env.local` cuando eso pase.
- **Callback:** `DLOCAL_RETURN_URL` puede quedarse en `http://localhost:9002/...` porque es el navegador del usuario el que vuelve ahí.
