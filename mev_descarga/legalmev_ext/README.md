# LegalMev Ext — seguimiento y exportación

Producto: extensión **LegalMev** (`legalmev_ext`).

## Seguimiento de expedientes

Al abrir un expediente, el dock ofrece **Seguir expediente** (mismo contrato de mensaje `MONITOR_ACTIVATE` / fachada):

- Guarda metadatos mínimos + línea de base en el primer escaneo.
- Escaneo programado (default 6 h, configurable) y manual.
- Alertas agrupadas por expediente, idempotentes.
- Sync cloud: solo metadatos → `/api/extension/watched-cases`.

Motor: `seguimiento/`, adaptadores `portales/`, sync `sync/`.

## Exportación bajo demanda

Módulos: `exportacion/` (nombres, categorías, PDF, empaquetado ZIP).  
Carpeta ZIP: `LegalMev_{PORTAL}_{nro}_{yyyyMMdd}` con `indice.pdf`.

## Pruebas

```bash
npm test
```

## Bóveda

`credenciales/boveda.js` — PIN + AES-GCM (local).
