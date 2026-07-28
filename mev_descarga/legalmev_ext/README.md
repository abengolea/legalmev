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

Módulos: `exportacion/` (nombres, categorías, PDF único).  
Descarga: un solo PDF (`LegalMev_{PORTAL}_{nro}_{yyyyMMdd}.pdf`).

## Pruebas

```bash
npm test
```

## Bóveda

`credenciales/boveda.js` — PIN + AES-GCM (local).
