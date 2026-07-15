# Integración del Scheduler Human-Like

Este documento describe cómo integrar los módulos de cola, delays y detección de riesgo en los content scripts existentes.

## Archivos agregados

Todos en `lib/`:

- `taskQueue.js` — Cola FIFO con prioridad
- `humanDelay.js` — Delays aleatorios human-like
- `riskDetector.js` — Detección de señales de bloqueo
- `backoffController.js` — Control de velocidad ante riesgo
- `localCache.js` — Caché en chrome.storage.session
- `logger.js` — Logs estructurados
- `scheduler.js` — Fachada única (orquesta todo)

## 1. Actualizar manifest.json

Agregar los scripts del scheduler **antes** del content script en cada entrada:

**MEV SCBA** (procesales.asp):
```json
"js": [
  "lib/taskQueue.js",
  "lib/humanDelay.js",
  "lib/riskDetector.js",
  "lib/backoffController.js",
  "lib/localCache.js",
  "lib/logger.js",
  "lib/scheduler.js",
  "content.js"
]
```

**PJN** (expediente.seam):
```json
"js": [
  "lib/pdf.min.js",
  "lib/taskQueue.js",
  "lib/humanDelay.js",
  "lib/riskDetector.js",
  "lib/backoffController.js",
  "lib/localCache.js",
  "lib/logger.js",
  "lib/scheduler.js",
  "content-pjn.js"
]
```

**MPBA** (VerProceso):
```json
"js": [
  "lib/pdf.min.js",
  "lib/tesseract.min.js",
  "lib/jspdf.min.js",
  "lib/taskQueue.js",
  "lib/humanDelay.js",
  "lib/riskDetector.js",
  "lib/backoffController.js",
  "lib/localCache.js",
  "lib/logger.js",
  "lib/scheduler.js",
  "content-mpba.js"
]
```

## 2. Activar/desactivar DEBUG_MODE

En la consola del content script (DevTools en la pestaña del sitio judicial):

```javascript
LegalMevLogger.setDebugMode(true);   // activar logs
LegalMevLogger.setDebugMode(false);  // desactivar
```

O desde el scheduler:

```javascript
LegalMevScheduler.setDebugMode(true);
```

Para activarlo por defecto durante desarrollo, editar `lib/logger.js` línea ~15:

```javascript
let DEBUG_MODE = true;  // cambiar a true para desarrollo
```

## 3. content.js (MEV SCBA) — YA INTEGRADO

El fetch en `collectActuacionesWithProgress` ya usa el scheduler con fallback:

```javascript
const scheduler = globalThis.LegalMevScheduler;
const html = scheduler ? await scheduler.fetch(url, { type: 'FETCH_HTML' }) : await fetch(url, { credentials: 'include' }).then((r) => r.text());
```

## 4. Reemplazos en content-pjn.js (PJN)

Hay múltiples fetches. Reemplazar cada uno según el tipo:

**Fetch de HTML (viewer/document.seam):**
```javascript
// ANTES:
const resp = await fetch(f.url, { ...fetchOpts, ... });
const html = await resp.text();

// DESPUÉS:
const html = await LegalMevScheduler.fetch(f.url, {
  type: 'FETCH_HTML',
  fetchOpts: { ...fetchOpts, headers: { ...fetchOpts.headers, Accept: '...' } }
});
```

**Fetch de PDF (cuando content-type es application/pdf):**
```javascript
// ANTES:
const resp = await fetch(url, fetchOpts);
const buffer = await resp.arrayBuffer();

// DESPUÉS:
const buffer = await LegalMevScheduler.fetch(url, {
  type: 'FETCH_PDF',
  skipCache: true,
  fetchOpts
});
```

**Ubicaciones concretas en content-pjn.js:**
- ~311 (extraerContenidoDeDialog): fetch del iframeUrl
- ~321 (extraerContenidoDeDialog): fetch del nestedUrl
- ~369 (extraerContenidoDeFila, link Ver): fetch urlVer
- ~382 (extraerContenidoDeFila): fetch iframeUrl
- ~406 (extraerContenidoDeFila): fetch urlVer
- ~416 (extraerContenidoDeFila): fetch iframeUrl
- ~438 (collectActuaciones): fetch f.url
- ~447 (collectActuaciones): fetch iframeUrl

Cada uno debe usar `LegalMevScheduler.fetch` con `type: 'FETCH_HTML'` o `type: 'FETCH_PDF'` según corresponda.

## 5. Reemplazos en content-mpba.js (MPBA)

**Línea ~175** en `fetchTextoTramite`:

```javascript
// ANTES:
resp = await fetch(url, { credentials: 'include', redirect: 'follow' });

// DESPUÉS:
const body = await LegalMevScheduler.fetch(url, {
  type: 'FETCH_PDF',
  skipCache: true,
  fetchOpts: { redirect: 'follow' }
});
// body es ArrayBuffer si es PDF, o string si es HTML
```

Para MPBA la respuesta puede ser PDF o HTML. El scheduler detecta por content-type. Si es PDF devuelve ArrayBuffer; si es HTML devuelve string. Ajustar el flujo de `fetchTextoTramite` para usar `body` directamente en lugar de `resp`.

## 6. Ejemplo de uso directo (para pruebas)

En la consola de una pestaña MEV/PJN/MPBA con la extensión cargada:

```javascript
// Fetch con delay human-like y cola
const html = await LegalMevScheduler.fetch('https://mev.scba.gov.ar/proveido.asp?x=123', {
  type: 'FETCH_HTML',
  priority: 'NORMAL'
});

// Fetch de alta prioridad (click manual)
const result = await LegalMevScheduler.fetch(url, {
  type: 'FETCH_HTML',
  priority: 'HIGH'
});

// Activar logs
LegalMevScheduler.setDebugMode(true);
```

## 7. Notificación al usuario (riesgo HIGH)

Para mostrar un mensaje cuando se detecta riesgo HIGH, configurar en el content script (o en un init común):

```javascript
LegalMevBackoffController.setOnNotifyUser(({ level, reason }) => {
  // Mostrar toast, alert o notificación en la UI
  console.warn('[LegalMev] Riesgo detectado:', level, reason);
});
```

## 8. Orden de carga

Los scripts deben cargarse en este orden (el manifest lo garantiza):

1. taskQueue
2. humanDelay
3. riskDetector
4. backoffController
5. localCache
6. logger
7. scheduler
8. content script (content.js, content-pjn.js o content-mpba.js)
