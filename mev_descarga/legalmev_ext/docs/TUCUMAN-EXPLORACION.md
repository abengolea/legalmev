# Tucumán — Exploración técnica (Portal SAE)

Fecha: 2026-07-15  
URLs:

- Login: `https://login.justucuman.gov.ar/login`
- Consulta: `https://consultaexpedientes.justucuman.gov.ar/`
- Historia: `https://consultaexpedientes.justucuman.gov.ar/{slug}/expediente/{nro}/historia`
  - Ejemplo: `/civil/expediente/3659%2F95/historia`

## Resumen

El Poder Judicial de Tucumán usa el **Portal del SAE** (Sistema de Administración de Expedientes). La UI de consulta es una **SPA React** (`consulta-expedientes-frontend`) sobre `consultaexpedientes.justucuman.gov.ar`. Los datos vienen de la API backend `conexpbe.justucuman.gov.ar/api`.

Flujo típico del usuario:

1. Login con **CUIL + contraseña** en `login.justucuman.gov.ar`.
2. En Consulta de Expedientes: elegir **Centro Judicial** (Capital, Concepción, etc.).
3. Elegir **fuero** (Civil y Comercial Común, Familia, Trabajo, …).
4. Buscar / abrir el expediente.
5. Entrar a **Historia** (tabla Fecha | Descripción | lupa).
6. LegalMev recopila los movimientos y arma el PDF.

## Arquitectura

| Capa | Detalle |
|------|---------|
| Frontend | React SPA (`#root`), rutas `/{jurisdiction}/expediente/{number}/historia` |
| API | `https://conexpbe.justucuman.gov.ar/api` |
| Prefijo logueado | `/user` (si hay cookie `saeToken`) → `/api/user/proceedings/...` |
| Auth | Cookie `saeToken` + header `Authorization: Bearer …` |

## Endpoints usados por LegalMev

### Jurisdicción por slug

```
GET /jurisdictions/slug?slug=civil
→ { id, name, description, slug, is_public }
```

### Historia (movimientos)

```
GET [/user]/proceedings/history?jurisdiction={id}&proceeding={procid}
→ { proceeding, stories: [{ histid, fecha, dscr, texto?, archivos?, … }] }
```

**Importante:** el path de la URL usa `nro_expediente` (`3659/95`), no el `procid`. El `procid` solo aparece en la respuesta de la API (por eso el `page-hook-tucuman.js` captura el GET de history al cargar la página).

### Texto de un movimiento

```
GET [/user]/proceedings/history/text?jurisdiction={id}&proceeding={procid}&history={histid}
```

Fallback PDF:

```
POST [/user]/proceedings/history/text/download
body: { proceeding, jurisdiction, history }
→ URL de descarga
```

### Adjuntos (escritos de partes)

Muchos movimientos (cargos, escritos de abogados/peritos) muestran en el modal:

> El escrito seleccionado no contiene texto.

El contenido está en el botón **ADJUNTOS**. LegalMev los baja con:

```
POST [/user]/proceedings/history/file
body: { proceeding, jurisdiction, history, file: base64(nombre) }
```

La lista de archivos suele venir en `stories[].archivos` (`{ nombre, extension }`) y a veces también en la respuesta de `/history/text`.


```
POST [/user]/proceedings/history/flipbook
body: { jurisdiction, proceeding }
→ { url }  // “Ver en formato de libro”
```

## Extensión LegalMev

| Archivo | Rol |
|---------|-----|
| `page-hook-tucuman.js` | MAIN world `document_start`: captura history + token |
| `content-tucuman.js` | `getExpedienteInfo` / `collectActuaciones` / monitoreo |
| Manifest | hosts `consultaexpedientes`, `conexpbe`, `login` |

Misma tubería que Salta/Entre Ríos: popup → `startExport` → `collectActuaciones` → `POST /api/export`.

## Cómo probar

1. Cargar extensión unpacked `mev_descarga/legalmev_ext` (v1.7.5+).
2. Iniciar sesión en el SAE.
3. Abrir un expediente → **Historia** (debe verse la tabla).
4. Si instalaste la extensión después: **F5** en Historia.
5. Abrir LegalMev → debería listar N movimientos → Exportar (todos o últimos N).
