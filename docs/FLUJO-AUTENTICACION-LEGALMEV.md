# Flujo de Autenticación LegalMev

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

## Seguridad

- La extensión **nunca** guarda contraseña
- La extensión **nunca** valida usuarios localmente
- Toda validación en backend con Firebase Admin `verifyIdToken`
- Token JWT de Firebase: expira (~1h), firmado, verificado por backend
