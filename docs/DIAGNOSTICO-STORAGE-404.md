# Diagnóstico: Error 404 "The specified bucket does not exist"

## Resumen del problema

Al exportar expedientes a PDF desde la extensión LegalMev (MEV/PJN), el backend en Firebase App Hosting falla con:

```json
{
  "error": {
    "code": 404,
    "message": "The specified bucket does not exist.",
    "errors": [
      {
        "message": "The specified bucket does not exist.",
        "domain": "global",
        "reason": "notFound"
      }
    ]
  }
}
```

**Cuándo ocurre:** Después del diálogo "Enviando y generando PDF..." — es decir, cuando el backend intenta guardar el PDF en Firebase Storage.

**Contexto:** El bucket SÍ existe en Firebase Console (Storage). El nombre es `caseclarity-hij0x.firebasestorage.app`. La exportación funciona en **local** (`npm run dev`).

---

## Stack técnico

- **Frontend:** Next.js 15, extensión Chrome
- **Backend:** Firebase App Hosting (Next.js en Cloud Run)
- **Storage:** Firebase Storage — bucket `caseclarity-hij0x.firebasestorage.app`
- **Proyecto:** `caseclarity-hij0x` (Firebase/Google Cloud)

---

## Lo que ya probamos

### 1. Verificación de credenciales
- Script `npm run check-credentials` — **OK** en local (Auth, Firestore, Storage pasan).
- Secrets en Google Cloud: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GOOGLE_GENAI_API_KEY`, `NEXT_PUBLIC_FIREBASE_*`.
- **No** existe secret `APP_STORAGE_BUCKET` — se usa `value:` en `apphosting.yaml`.

### 2. Configuración del bucket
- `apphosting.yaml`: `APP_STORAGE_BUCKET` = `caseclarity-hij0x.firebasestorage.app`.
- Se agregó `availability: [RUNTIME, BUILD]` para que la variable esté disponible en runtime.
- En Firebase Console → Storage el bucket aparece correctamente con ese nombre.

### 3. Código (`src/lib/firebase-admin.ts`)
- Fallback a `FIREBASE_CONFIG.storageBucket` (inyectado por App Hosting).
- Fallback final: `{projectId}.firebasestorage.app`.
- Orden de prioridad: `APP_STORAGE_BUCKET` → `FIREBASE_CONFIG` → `projectId.firebasestorage.app`.

### 4. Despliegues
- Nuevos rollouts ejecutados con `firebase apphosting:rollouts:create legalmev --git-branch main`.
- El error persiste después del deploy.

### 5. Errores anteriores (ya resueltos)
- **DECODER routines::unsupported:** Se resolvió actualizando `FIREBASE_PRIVATE_KEY` y verificando credenciales.
- **Bucket 404:** Es el problema actual.

---

## Archivos relevantes

### `apphosting.yaml` (fragmento)
```yaml
env:
  - variable: APP_PROJECT_ID
    secret: FIREBASE_PROJECT_ID
  - variable: APP_CLIENT_EMAIL
    secret: FIREBASE_CLIENT_EMAIL
  - variable: APP_PRIVATE_KEY
    secret: FIREBASE_PRIVATE_KEY
  - variable: APP_STORAGE_BUCKET
    value: caseclarity-hij0x.firebasestorage.app
    availability:
      - RUNTIME
      - BUILD
```

### `src/lib/firebase-admin.ts` (lógica del bucket)
```typescript
// Fallback: FIREBASE_CONFIG (App Hosting) → projectId.firebasestorage.app
const fromFirebaseConfig = ((): string | null => {
  try {
    const cfg = process.env.FIREBASE_CONFIG;
    if (cfg && typeof cfg === 'string' && cfg.trim().startsWith('{')) {
      const parsed = JSON.parse(cfg) as { storageBucket?: string };
      return parsed?.storageBucket?.trim() || null;
    }
  } catch { /* ignorar */ }
  return null;
})();
const storageBucket =
  cred.storageBucket?.trim() || fromFirebaseConfig || `${cred.projectId}.firebasestorage.app`;
```

### `src/app/api/export/route.ts` (uso de Storage)
```typescript
const adminStorage = getAdminStorage();
const bucket = adminStorage.bucket();  // usa storageBucket del init
const file = bucket.file(`exports/${filename}`);
await file.save(Buffer.from(pdfBytes), { metadata: { contentType: 'application/pdf' } });
```

---

## Hipótesis sin confirmar

1. **Env vars no inyectadas en runtime** en App Hosting / Cloud Run para Next.js.
2. **`availability`** en `apphosting.yaml` no aplicada o con sintaxis incorrecta.
3. **`FIREBASE_CONFIG`** no disponible o sin `storageBucket` en el contenedor.
4. **Permisos IAM** de la cuenta de servicio sobre el bucket (posible, pero menos probable porque funciona en local).

---

## Lo que no pudimos verificar

- Variables de entorno efectivas en el contenedor del rollout (no hay logs de debug).
- Si `FIREBASE_CONFIG` existe y qué `storageBucket` tiene en runtime.
- Documentación oficial de Firebase App Hosting sobre `availability` para env vars.

---

## Pedido de ayuda

Necesitamos entender por qué el backend en Firebase App Hosting recibe un bucket inexistente cuando:

1. El bucket `caseclarity-hij0x.firebasestorage.app` existe en Firebase Storage.
2. La misma configuración funciona en local.
3. Las credenciales están correctas (`check-credentials` pasa en local).
4. `APP_STORAGE_BUCKET` está definido en `apphosting.yaml` con `value: caseclarity-hij0x.firebasestorage.app`.

¿Hay alguna limitación conocida de App Hosting con las variables `value:` en runtime? ¿Se recomienda usar `secret:` para variables no sensibles como el nombre del bucket? ¿Cómo se puede comprobar qué env vars llegan al contenedor en un rollout?

---

## Pasos sugeridos para depuración

1. Crear `APP_STORAGE_BUCKET` como **secret** y referenciarlo en `apphosting.yaml` en lugar de `value:`.
2. Agregar logs temporales en `/api/export` para imprimir `process.env.APP_STORAGE_BUCKET`, `process.env.FIREBASE_CONFIG` y el bucket usado antes de `file.save()`.
3. Verificar en Firebase Console → App Hosting → Rollout la sección "Environment variables in this build".
4. Revisar IAM de la cuenta de servicio `firebase-adminsdk-*` para roles de Storage en el proyecto.
