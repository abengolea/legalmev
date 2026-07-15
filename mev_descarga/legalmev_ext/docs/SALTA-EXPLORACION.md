# Salta — Exploración técnica (consulta pública IOL/SED)

Fecha: 2026-03-11  
URL de prueba: `https://plataforma.justiciasalta.gov.ar/iol-ui/p/expedientes?identificador=gomez%20daños&tituloBusqueda=Causas&tipoBusqueda=CAU`

## Resumen

El Poder Judicial de Salta usa **IOL** (plataforma Angular) sobre `plataforma.justiciasalta.gov.ar`. La consulta pública **no requiere login**: las rutas usan el prefijo `/iol-ui/p/` (público) en lugar de `/iol-ui/u/` (usuario autenticado con Keycloak).

Es análogo a una **consulta web abierta** (similar en espíritu a consultas civiles públicas): la UI es una SPA y los datos vienen por **REST API** con prefijo `public/` cuando no hay sesión.

## Flujo de usuario

1. Buscar por carátula/identificador en `/iol-ui/p/expedientes` (o `/p/causas`).
2. Click en **Carátula** → se expande el detalle **en la misma página** (no cambia la URL a otra ruta).
3. Pestañas: **Ficha | Actuaciones | Sujetos | Causas Relacionadas | Movimientos**.
4. En **Actuaciones**: tabla con despachos, escritos, cédulas; click en título abre PDF.

## Arquitectura técnica

| Capa | Detalle |
|------|---------|
| Frontend | Angular SPA (`<iol-root>`), bundle `main.*.js` |
| Rutas públicas | `/iol-ui/p/inicio`, `/p/expedientes`, `/p/causas`, etc. |
| API base | `https://plataforma.justiciasalta.gov.ar/iol-api/api/` |
| API pública | Mismo path con prefijo `public/` (interceptor Angular sin token Keycloak) |
| Auth (SED logueado) | Keycloak en `/auth/realms/iol` — **no aplica** a consulta pública |

## Endpoints públicos verificados

### Búsqueda de causas

```
POST /iol-api/api/public/expedientes/lista
Content-Type: application/json

{
  "filter": "{\"identificador\":\"gomez daños\",\"caratula\":\"gomez daños\"}",
  "tipoBusqueda": "CAU",
  "page": 0,
  "size": 10
}
```

Respuesta: `{ content: [{ expId, caratula, codigoOrganismoRadActual, ... }], totalElements, ... }`

### Encabezado del expediente

```
GET /iol-api/api/public/expedientes/encabezado?expId={expId}
```

Campos útiles: `caratula`, `cuij`, `numero`, `anio`, `tipoExpediente`, `estadoAdministrativo`, `jueztramite`, `organismoRadActual`, `codigoOrganismoRadActual`.

### Ficha

```
GET /iol-api/api/public/expedientes/ficha?expId={expId}
```

### Actuaciones (pestaña Actuaciones)

```
GET /iol-api/api/public/expedientes/actuaciones?filtro={JSON}&page=0&size=10
```

`filtro` (objeto JSON stringificado y URL-encoded):

```json
{
  "cedulas": true,
  "escritos": true,
  "despachos": true,
  "movimientos": true,
  "expId": "177202000239210021000"
}
```

Campos por actuación: `actId`, `titulo`, `tipo`, `numero`, `fechaFirma`, `fechaPublicacion`, `firmantes`, `organismo`, `poseeAdjunto`, `esDespacho`, `esEscrito`, `esCedula`.

### PDF de actuación

```
GET /iol-api/api/public/expedientes/actuaciones/pdf?actId={actId}&org={codigoOrg}&expId={expId}&tipo={tipo}
```

- `org`: código de organismo (ej. `SC0102`), obtenible de `encabezado` o del campo `organismo` de la actuación.
- `tipo`: URL-encoded (ej. `ACTUACION%20GENERICA`, `ESCRITOS`).
- Respuesta: `application/pdf` (verificado: 200, bytes `%PDF-`).

### Adjuntos

```
GET /iol-api/api/public/expedientes/actuaciones/adjuntos?actId={actId}&preExpId={expId}
→ { adjuntos: [{ adjId, fecha, titulo }] }

GET /iol-api/api/public/expedientes/actuaciones/adjuntoPdf?aacId={adjId}&actId={actId}&preExpId={expId}&tipo={tipo}
→ application/pdf
```

Importante: el query param se llama `aacId` pero el valor viene del campo `adjId` de la lista.
LegalMev baja estos PDFs (escritos / documentales del clip Adjuntos) y los une al PDF exportado junto con el PDF de la actuación.

## Implicaciones para LegalMev

### Ventajas

- **Sin login judicial**: no hay que manejar Keycloak ni cookies de abogado.
- **API REST estable**: podemos llamar `fetch` desde el content script sin depender solo del DOM.
- **PDFs directos**: descarga por URL, sin OCR (a diferencia de MPBA en algunos casos).

### Desafíos

1. **SPA sin URL de expediente**: al abrir la carátula la ruta suele seguir siendo `/p/expedientes?...`; hay que detectar el panel abierto o interceptar llamadas a `encabezado`/`actuaciones`.
2. **expId interno**: no es el número visible (ej. `CAM 204201/7`); es un ID largo (`172151002042010007000`).
3. **Causas antiguas**: pueden tener 0 actuaciones digitales (ej. expediente 2007 del screenshot).
4. **Paginación**: actuaciones paginadas (default 5–10 por página en la UI).
5. **Integración popup**: registrar portal `salta` en `popup.js`, `manifest.json` host_permissions, y posiblemente **sin cuota backend** o flujo distinto si es consulta pública.

### Instructivo para el usuario (lista de causas)

La consulta pública muestra **muchas causas** en una misma pantalla; la URL no cambia al elegir una fila. Por eso LegalMev **no puede saber** cuál expediente exportar desde la lista.

**Flujo correcto:**

1. Buscar por nombre o CUIJ en [consulta pública Salta](https://plataforma.justiciasalta.gov.ar/iol-ui/p/expedientes).
2. En la fila del expediente deseado, tocar el ícono **↗** (abrir en ventana) junto al cartel **EN TRÁMITE**.
3. En la ficha abierta, ir a la pestaña **Actuaciones**.
4. Abrir la extensión LegalMev y exportar.

El popup de la extensión muestra este instructivo automáticamente cuando detecta la lista sin expediente abierto.

### Estrategia recomendada para `content-salta.js`

1. **Content script** en `https://plataforma.justiciasalta.gov.ar/iol-ui/p/*`.
2. **Detección de expediente abierto**:
   - Observer sobre pestañas `Actuaciones` / componente `iol-expediente-actuaciones`, o
   - Hook de `fetch`/`XHR` para capturar `expId` cuando se llama a `encabezado?expId=`.
3. **Extracción**: llamar API pública con el `expId` capturado (más robusto que scrapear la tabla Angular).
4. **Exportación**: descargar PDFs vía `actuaciones/pdf`, merge con pdf-lib/jspdf (como PJN).
5. **Mensaje al popup**: `{ portal: 'salta', expId, caratula, count, actuaciones }`.

### Manifest (borrador)

```json
"host_permissions": [
  "https://plataforma.justiciasalta.gov.ar/*"
],
"content_scripts": [{
  "matches": ["https://plataforma.justiciasalta.gov.ar/iol-ui/p/*"],
  "js": ["lib/pdf.min.js", "content-salta.js"],
  "run_at": "document_idle"
}]
```

## Comparación con otros portales LegalMev

| Portal | Auth | Tecnología | PDFs |
|--------|------|------------|------|
| MEV SCBA | Login MEV | HTML clásico (`proveido.asp`) | HTML → PDF |
| PJN | Login PJN | JSF/Seam | PDF nativo |
| MPBA | Login MPBA | DataTables + OCR en algunos casos | Mixto |
| **Salta público** | **Ninguno** | **Angular + REST** | **PDF nativo (API)** |

## Próximo paso

Implementar `content-salta.js` con detección de `expId` + export vía API pública. Probar con un expediente que tenga actuaciones (ej. búsqueda `gomez daños` → causas con 100+ actuaciones).

## Nota sobre SED con login

El mismo dominio `plataforma.justiciasalta.gov.ar` sirve el **SED para abogados** (`/iol-ui/u/*` con Keycloak). La v1.4 puede empezar solo con **consulta pública** (`/p/*`); el modo logueado sería una extensión futura si hace falta.
