# Flujo de Autenticación LegalMev

## Regla crítica: verificar sesión ANTES de cualquier acción

**La extensión DEBE detectar si el usuario está logueado PRIMERO, antes de hacer búsqueda, detección de expediente o exportación.**

- Si NO está logueado → pedir "Conectar cuenta" / abrir extension-connect.
- Si SÍ está logueado → continuar con detección de expediente y exportación.

**INCORRECTO:** Hacer la búsqueda/detección → intentar exportar → recibir 401 → recién ahí pedir login.  
**INCORRECTO:** Mostrar "Conectada" o iniciar la descarga del PDF y luego pedir login cuando falle.  
**CORRECTO:** Al iniciar (popup o content script en MEV/PJN), verificar authToken → si falta, mostrar "Conectá tu cuenta" de inmediato, sin scrapear ni exportar nada. El usuario debe saber desde el principio que necesita iniciar sesión en la web.

### Gestión de sesión (cambio de cuenta)

**NUNCA confiar en caché local.** Cuando el usuario cambia de cuenta (logout + login con otra), la extensión debe detectarlo y limpiar toda la sesión anterior.

- Usar `GET /api/extension/session` para validar sesión contra el backend.
- Si `userId` cambia → limpiar todo (`chrome.storage.local` + `chrome.storage.sync`).
- Ver [EXTENSION-SESSION.md](./EXTENSION-SESSION.md) para la implementación completa del Session Manager.

En **popup.js** y en cualquier **content script** que maneje "Exportar":

1. Obtener `authToken` de `chrome.storage.local.get('authToken')`.
2. Si `!authToken` → `showState(NO_AUTH)` / abrir extension-connect. **No continuar.**
3. Solo si existe token → proceder con detección de expediente y exportación.

### Dónde aplicar el cambio

| Ubicación | Qué verificar |
|-----------|---------------|
| `popup.js` — `init()` | Antes de mostrar DETECTADO o botón Exportar, comprobar `authToken`. Si falta → `showState(NO_AUTH)`. |
| Content script en MEV/PJN | Antes de scrapear actuaciones o llamar a `/api/export`, pedir token al background (`chrome.runtime.sendMessage`) y verificar. Si no hay token → mostrar "Conectá tu cuenta" y abrir extension-connect; **no scrapear ni exportar**. |
| Botón "Exportar a PDF" | El handler del clic debe comprobar auth **antes** de recopilar datos y hacer el fetch. |

---

## Diagrama de flujo completo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           USUARIO INSTALA EXTENSIÓN                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     Abre popup      ┌──────────────────────────────────────────────┐
│   Usuario    │ ──────────────────► │  popup.js: init()                            │
│              │                     │  • chrome.storage.local.get('authToken')     │
└──────────────┘                     │  • ¿Token existe?                            │
                                     └───────────────┬──────────────────────────────┘
                                                     │
                      ┌──────────────────────────────┼──────────────────────────────┐
                      │ NO                          │ SÍ                           │
                      ▼                             ▼                              │
┌─────────────────────────────────┐   ┌─────────────────────────────────────────────┐
│ showState(NO_AUTH)              │   │ Flujo normal: INACTIVO → DETECTADO → etc.   │
│ • Pantalla "Conectar cuenta"    │   │ • Verifica expediente en tab activa         │
│ • Botón "Conectar con LegalMev" │   │ • Exportación con Authorization header       │
└─────────────────┬───────────────┘   └─────────────────────────────────────────────┘
                  │
                  │ Click "Conectar"
                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ chrome.tabs.create({ url: API_BASE + '/extension-connect' })                     │
│ Se abre: https://caseclarity-hij0x.web.app/extension-connect                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PÁGINA WEB /extension-connect                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. onAuthStateChanged()                                                           │
│    • ¿Usuario logueado?                                                          │
│      NO  → router.replace('/login?redirect=/extension-connect')                   │
│      SÍ  → Continuar                                                             │
│ 2. user.getIdToken(true)  →  Firebase ID Token (JWT)                             │
│ 3. window.postMessage({ type: 'LEGALMEV_AUTH_TOKEN', token }, origin)             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                   CONTENT SCRIPT (content-extension-connect.js)                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ • Inyectado solo en /extension-connect (matches en manifest)                      │
│ • window.addEventListener('message')                                             │
│ • Valida: event.data.type === 'LEGALMEV_AUTH_TOKEN'                             │
│ • chrome.runtime.sendMessage({ action: 'AUTH_TOKEN_RECEIVED', token })           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND (background.js)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ • Listener: message.action === 'AUTH_TOKEN_RECEIVED'                             │
│ • chrome.storage.local.set({ authToken: token })                                 │
│ • chrome.tabs.remove(sender.tab.id)  → Cierra pestaña extension-connect          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                    chrome.storage.onChanged (popup.js)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ • authToken cambió → authToken = newValue; init()                                 │
│ • Popup se actualiza y muestra flujo normal (INACTIVO o DETECTADO)              │
└─────────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════
                           EXPORTACIÓN (con token)
═══════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────────┐
│  fetch(API_BASE + '/api/export', {                                               │
│    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN' }│
│  })                                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Backend: /api/export y /api/extension/me                                        │
│  • getAuth().verifyIdToken(token)                                                 │
│  • 401 → Extensión: clearAuthAndShowConnect() → showState(NO_AUTH)               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Componentes modificados/creados

| Archivo | Cambios |
|---------|---------|
| `manifest.json` | `storage` permission, content script para extension-connect |
| `popup.html` | Nuevo estado `state0` (Conectar cuenta) |
| `popup.js` | Verificación token, authHeaders(), clearAuthAndShowConnect(), manejo 401 |
| `background.js` | Listener AUTH_TOKEN_RECEIVED → storage + cerrar tab |
| `content-extension-connect.js` | Escucha postMessage, reenvía a background |
| `src/app/extension-connect/page.tsx` | Página que obtiene token y postMessage |
| `src/app/api/extension/me/route.ts` | GET con Bearer, devuelve `{ ok, user: { id, email, plan } }` |
| `src/app/login/page.tsx` | Soporte `?redirect=` para volver a extension-connect |

## Controlador de acciones de correo electrónico (Firebase)

Los emails de Firebase (verificación de email, restablecer contraseña, revertir cambio de email) usan un controlador personalizado en lugar del dominio por defecto de Firebase.

**Página:** `/auth/action` — maneja `mode=verifyEmail`, `mode=resetPassword`, `mode=recoverEmail`.

### Configurar en Firebase Console

1. Ir a **Authentication** → **Templates**.
2. En cada plantilla (Verificación de email, Restablecer contraseña, etc.) → clic en editar.
3. **Personalizar URL de acción** e ingresar:
   ```
   https://www.legalmev.com.ar/auth/action
   ```
   (Para local: `http://localhost:9002/auth/action` — solo para pruebas.)

4. Guardar.

Firebase agregará automáticamente los parámetros `mode`, `oobCode`, `apiKey`, `continueUrl`, `lang` a esa URL.

---

## Seguridad

- La extensión **nunca** guarda contraseña
- La extensión **nunca** valida usuarios localmente
- Toda validación en backend con Firebase Admin `verifyIdToken`
- Token JWT de Firebase: expira (~1h), firmado, verificado por backend
