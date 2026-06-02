# Facturación LegalMev → NotificasHub

LegalMev es producto de **Notificas S.R.L.** Los cobros por Mercado Pago disparan emisión de factura ARCA en NotificasHub y quedan en contabilidad (`/admin/contabilidad` → Facturas).

## Flujo

1. Pago aprobado en Mercado Pago → `POST /api/payments/mercadopago-webhook`
2. Se registra en Firestore `pagos` y se activa premium / convenio colegio
3. LegalMev llama a NotificasHub `POST /api/integrations/notificas/billing/emit`
4. Hub solicita CAE en AFIP y guarda en `accounting_notificas_srl_facturas` con `sourceSystem: legalmev`

La acreditación del servicio **no depende** de que la factura se emita; si falla AFIP, el pago queda registrado y `pagos.billingHub` indica el error.

## Variables (LegalMev)

En `.env.local` / Firebase App Hosting:

```env
MERCADOPAGO_ACCESS_TOKEN=...

NOTIFICASHUB_URL=https://notificashub--studio-3864746689-59018.us-east4.hosted.app
NOTIFICAS_BILLING_SHARED_SECRET=   # misma clave que en NotificasHub
MERCADOPAGO_HUB_EMIT_FACTURA=true # o LEGALMEV_HUB_EMIT_FACTURA=true
# Opcional:
# MERCADOPAGO_HUB_CBTE_TIPO=B
```

En NotificasHub debe existir `NOTIFICAS_BILLING_SHARED_SECRET` y certificados AFIP de Notificas S.R.L.

## Datos del comprador

- Usuario premium: `users/{uid}` → `name`, `email`, `cuit` (ajustes de cuenta)
- Colegio: `colegios/{id}` → `name`, `cuit`, `contactoFacturacion`

## Idempotencia

Clave: `legalmev_mp_{paymentId}` — reintentos del webhook no duplican comprobantes.

## Pagos

Solo **Mercado Pago** (Checkout Pro). DLocal fue retirado.

## Usuario: historial y facturas PDF

- Pantalla: `/dashboard/pagos` (menú lateral «Pagos y facturas»).
- API: `GET /api/user/pagos`, `GET /api/user/invoices/{pagoId}` (reintenta emisión Hub si falta CAE).

## Colegio (cuotas del convenio — solo superadmin)

- Pantalla: `/dashboard/colegio/pagos?colegioId=...` (menú Admin → «Cuotas colegio»). Requiere `role=admin`.
- API: `GET /api/colegio/pagos?colegioId=...`, `GET /api/colegio/invoices/{pagoId}` (ambas solo superadmin).
- Los responsables del colegio (`adminEmails`) pueden pagar cuotas desde Mi colegio, pero no ven el historial ni facturas.

## Script de diagnóstico

```bash
# Solo conectividad + secret (no emite factura)
npm run test:hub-billing

# Emite Factura B de prueba en homologación (~$100 ARS)
npm run test:hub-billing:emit
# o con monto:
node scripts/test-hub-billing.js --emit-test 150
```
