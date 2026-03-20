# Gestión de sesión en la extensión LegalMev

## Problema resuelto

Cuando el usuario cambia de cuenta (logout + login con otra), la extensión seguía usando la sesión anterior (plan, cuotas, etc.). Esto causaba comportamiento incorrecto.

## Solución: Session Manager

### 1. API de sesión

**GET /api/extension/session**

Headers: `Authorization: Bearer <token>`

Respuesta:

```json
{
  "authenticated": true,
  "userId": "abc123",
  "email": "user@example.com",
  "plan": "free" | "pro" | "unlimited",
  "remainingQueries": 3
}
```

- `remainingQueries`: `null` para plan unlimited, número para free/pro
- Si no hay token o es inválido: `authenticated: false`, `userId: ""`, etc.

### 2. Session Manager

**Ubicación:** `mev_descarga/mev_exporter_ext/lib/sessionManager.js`

Ya integrado en la extensión. Se carga en:
- `popup.html` (antes de popup.js)
- `background.js` (via `importScripts`)

**Inicialización:** El popup llama `LegalMevSessionManager.initSessionManager()` en `init()`.

### 3. Antes de CUALQUIER acción

Antes de:
- Exportar a PDF
- Hacer cualquier query
- Mostrar estado (conectado, cuotas, etc.)

```javascript
const session = await getFreshSession();

if (!session.authenticated) {
  showState(NO_AUTH); // "Conectá tu cuenta"
  return;
}

if (session.remainingQueries === 0 && session.plan !== 'unlimited') {
  showState(QUOTA_EXCEEDED); // "Sin descargas disponibles"
  return;
}

// Continuar con la acción
```

### 4. Al recibir nuevo token (AUTH_TOKEN_RECEIVED)

En `background.js` (ya implementado): cuando llega el mensaje con el nuevo token, se llama `clearExtensionSession()` e `invalidateSessionCache()` **antes** de guardar el nuevo token.

### 5. Manejo de 401 en export

Si `/api/export` devuelve 401:

```javascript
if (res.status === 401) {
  await clearExtensionSession();
  showState(NO_AUTH);
  return;
}
```

### 6. Eliminar lógica antigua

- NO guardar `plan` o `isUnlimited` en chrome.storage
- NO usar contadores locales para cuotas
- El backend es la única fuente de verdad

## Flujo resumido

1. Usuario abre popup → `getFreshSession()` → si !authenticated → "Conectá tu cuenta"
2. Usuario hace clic en Exportar → `getFreshSession()` → validar cuotas → si OK, exportar
3. Usuario cambia de cuenta en web → vuelve a extension-connect → nuevo token → background hace `clearExtensionSession()` + guarda token
4. Próxima acción → `getFreshSession()` detecta userId nuevo (o caché vacía) → sesión correcta
