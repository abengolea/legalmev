# Trazabilidad FASE 4 — reescritura seguimiento/exportación

## Procedimiento

1. Auditoría FASE 1 (referencia externa no usada como plantilla).
2. Specs FASE 2 aprobadas (SPEC-01…09).
3. Diseño FASE 3 aprobado.
4. Implementación: módulos nuevos + tests de aceptación primero; cableado; retiro de módulos previos.

## Archivos nuevos (extensión)

- `seguimiento/*` — idempotencia, comparar, repositorio, motor, bootstrap, errores
- `exportacion/*` — nombres, categorías, texto-pdf, empaquetar
- `portales/adaptador-mock.js`, `portales/adaptador-browser.js`
- `sync/metadatos.js`, `sync/cuenta.js`
- `credenciales/boveda.js`
- `test/unit/acceptance.test.cjs`

## Archivos nuevos (Next)

- `src/app/api/extension/sugerencias-novedad/route.ts`
- `src/app/api/extension/sugerencias-novedad/[id]/decidir/route.ts`

## Retiros

- `lib/monitoring/*`, `lib/case-monitor.js`, `lib/vault.js`, `lib/filename.js`, `lib/categories.js`, `lib/pdf-text.js`, `lib/export-runner.js` → stubs que fallan si se cargan.

## Fuentes legítimas

- SPEC-01…09 del prompt LegalMEV
- Auth device / Firestore users existentes
- Web Crypto / Manifest V3 / jsPDF / JSZip (licencias de las libs ya en el proyecto)

## Dependencias nuevas

Ninguna dependencia npm nueva. Reuso: jsPDF, JSZip (vendor), Web Crypto API.

## No se afirma

Independencia legal “garantizada”. Se documenta el procedimiento seguido.
