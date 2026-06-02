#!/usr/bin/env node
/**
 * Prueba de conectividad y autenticación del flujo LegalMev → NotificasHub → ARCA.
 *
 * Por defecto NO emite facturas reales: solo verifica env, URL y Bearer secret.
 *
 * Uso:
 *   node scripts/test-hub-billing.js
 *   node scripts/test-hub-billing.js --emit-test          # emite factura B de prueba en homologación
 *   node scripts/test-hub-billing.js --emit-test 150      # monto ARS (default 100, máx 500)
 *
 * Requiere en .env.local (raíz del proyecto):
 *   NOTIFICASHUB_URL
 *   NOTIFICAS_BILLING_SHARED_SECRET  (o LEGALMEV_BILLING_SHARED_SECRET)
 *   MERCADOPAGO_HUB_EMIT_FACTURA=true  (recomendado; el script avisa si falta)
 *
 * Para --emit-test: el Hub debe tener AFIP en homologación (AFIP_PRODUCTION=false).
 * NO uses --emit-test en producción salvo que sepas que generás un comprobante real.
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

function loadEnvFiles() {
  const files = ['.env.local', '.env', '.env.development.local'];
  for (const file of files) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, 'utf8');
    for (const line of raw.split(/\r\n|\r|\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val.replace(/\\n/g, '\n');
      }
    }
  }
}

function mask(s) {
  if (!s) return '(vacío)';
  const t = String(s).trim();
  if (t.length <= 6) return '***';
  return `${t.slice(0, 4)}…${t.slice(-2)} (${t.length} chars)`;
}

function billingEmitUrl() {
  const explicit =
    process.env.NOTIFICASHUB_BILLING_EMIT_URL ||
    process.env.NOTIFICAS_HUB_BILLING_EMIT_URL;
  if (explicit?.trim()) return explicit.trim();

  const hubBase = process.env.NOTIFICASHUB_URL?.trim().replace(/\/+$/, '');
  if (!hubBase) return undefined;
  return `${hubBase}/api/integrations/notificas/billing/emit`;
}

function billingSharedSecret() {
  return (
    process.env.NOTIFICAS_BILLING_SHARED_SECRET ||
    process.env.NOTIFICASHUB_BILLING_SHARED_SECRET ||
    process.env.LEGALMEV_BILLING_SHARED_SECRET ||
    ''
  ).trim();
}

function hubEmitEnabled() {
  return (
    process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ||
    process.env.LEGALMEV_HUB_EMIT_FACTURA === 'true' ||
    process.env.NOTIFICASHUB_BILLING_FORCE_EMIT === 'true'
  );
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}

function info(msg) {
  console.log(`  · ${msg}`);
}

async function postJson(url, secret, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json, text: text.slice(0, 400) };
}

async function main() {
  const args = process.argv.slice(2);
  const emitTest = args.includes('--emit-test');
  const amountArg = args.find((a) => /^\d+(\.\d+)?$/.test(a));
  const amount = Math.min(500, Math.max(1, Number(amountArg ?? 100)));

  console.log('');
  console.log('LegalMev — diagnóstico facturación NotificasHub');
  console.log('═'.repeat(56));
  console.log('');

  loadEnvFiles();

  const url = billingEmitUrl();
  const secret = billingSharedSecret();
  const emitFlag = hubEmitEnabled();

  console.log('1) Variables de entorno');
  if (process.env.NOTIFICASHUB_URL?.trim()) {
    ok(`NOTIFICASHUB_URL = ${process.env.NOTIFICASHUB_URL.trim()}`);
  } else if (process.env.NOTIFICASHUB_BILLING_EMIT_URL?.trim()) {
    ok(`NOTIFICASHUB_BILLING_EMIT_URL = ${process.env.NOTIFICASHUB_BILLING_EMIT_URL.trim()}`);
  } else {
    fail('Falta NOTIFICASHUB_URL o NOTIFICASHUB_BILLING_EMIT_URL');
  }

  if (secret) {
    ok(`Secreto compartido = ${mask(secret)}`);
  } else {
    fail('Falta NOTIFICAS_BILLING_SHARED_SECRET (o LEGALMEV_BILLING_SHARED_SECRET)');
  }

  if (emitFlag) {
    ok('Emisión automática habilitada (MERCADOPAGO_HUB_EMIT_FACTURA / LEGALMEV_HUB_EMIT_FACTURA)');
  } else {
    warn('MERCADOPAGO_HUB_EMIT_FACTURA no está en true — los webhooks no emitirán factura');
  }

  if (!url || !secret) {
    console.log('');
    console.log('Corregí .env.local y volvé a ejecutar: node scripts/test-hub-billing.js');
    process.exit(1);
  }

  info(`URL emit: ${url}`);
  console.log('');

  let exitCode = 0;

  console.log('2) Conectividad HTTP');
  try {
    const bad = await postJson(url, 'token-invalido-diagnostico', { paymentId: 'x', amount: 1 });
    if (bad.status === 401) {
      ok('Endpoint responde (401 con token inválido — esperado)');
    } else if (bad.status === 404) {
      fail('Endpoint no encontrado (404). ¿URL del Hub correcta?');
      info(bad.text || JSON.stringify(bad.json));
      exitCode = 1;
    } else if (bad.status === 503) {
      warn(`Hub respondió 503: ${bad.json.error ?? bad.text}`);
      info('Puede faltar NOTIFICAS_BILLING_SHARED_SECRET en el servidor Hub.');
      exitCode = 1;
    } else {
      warn(`Respuesta inesperada con token inválido: HTTP ${bad.status}`);
      info(JSON.stringify(bad.json));
    }
  } catch (e) {
    fail(`No se pudo contactar al Hub: ${e instanceof Error ? e.message : e}`);
    info('Verificá red, NOTIFICASHUB_URL y que el deploy del Hub esté activo.');
    process.exit(1);
  }

  console.log('');
  console.log('3) Autenticación (Bearer secret)');
  try {
    const authCheck = await postJson(url, secret, {});
    if (authCheck.status === 400) {
      ok('Secret aceptado (400 validación — auth OK, body incompleto)');
    } else if (authCheck.status === 401) {
      fail('Secret rechazado (401). El valor en LegalMev no coincide con el del Hub.');
      exitCode = 1;
    } else {
      info(`HTTP ${authCheck.status}: ${JSON.stringify(authCheck.json)}`);
    }
  } catch (e) {
    fail(`Error en prueba de auth: ${e instanceof Error ? e.message : e}`);
    exitCode = 1;
  }

  if (!emitTest) {
    console.log('');
    console.log('4) Emisión de prueba');
    info('Omitida (modo seguro). Para probar CAE en homologación:');
    info('  node scripts/test-hub-billing.js --emit-test');
    info('  node scripts/test-hub-billing.js --emit-test 150');
    console.log('');
    console.log(exitCode === 0 ? 'Resultado: OK (conectividad y auth)' : 'Resultado: REVISAR errores arriba');
    process.exit(exitCode);
  }

  console.log('');
  console.log('4) Emisión de prueba (Factura B consumidor final)');
  warn(`Se solicitará CAE real al Hub por $${amount} ARS (idempotencia única).`);
  warn('Usá solo en homologación AFIP salvo que quieras un comprobante real.');

  const ts = Date.now();
  const paymentId = `legalmev_diagnostic_${ts}`;
  const payload = {
    idempotencyKey: paymentId,
    paymentId,
    amount,
    amountIncludesVat: true,
    cbteTipo: 'B',
    buyer: {
      email: 'diagnostico@legalmev.com.ar',
      razonSocial: 'Prueba Diagnostico LegalMev',
    },
    item: {
      description: 'Prueba diagnostico facturacion LegalMev (no comercial)',
    },
    metadata: {
      source_app: 'legalmev',
      diagnostic: true,
      script: 'test-hub-billing.js',
    },
  };

  try {
    const emit = await postJson(url, secret, payload);
    console.log('');
    info(`HTTP ${emit.status}`);

    if (emit.status >= 200 && emit.status < 300 && emit.json.ok !== false) {
      ok('Factura emitida o ya existía (idempotencia)');
      if (emit.json.facturaId) info(`facturaId: ${emit.json.facturaId}`);
      if (emit.json.CAE) info(`CAE: ${emit.json.CAE}`);
      if (emit.json.CAEFchVto) info(`Vto CAE: ${emit.json.CAEFchVto}`);
      if (emit.json.voucherNumber != null) {
        info(`Comprobante: ${emit.json.ptoVta}-${emit.json.voucherNumber}`);
      }
      if (emit.json.environment) info(`Ambiente Hub: ${emit.json.environment}`);
      if (emit.json.alreadyIssued) info('alreadyIssued: true (reintento idempotente)');
    } else if (emit.status === 202) {
      warn('Emisión en proceso (202). Reintentá en unos segundos con la misma idempotencyKey.');
      info(JSON.stringify(emit.json));
      exitCode = 1;
    } else {
      fail(`Emisión falló: ${emit.json.error ?? emit.json.message ?? emit.text}`);
      if (emit.json.details) info(JSON.stringify(emit.json.details));
      exitCode = 1;
    }
  } catch (e) {
    fail(`Error al emitir: ${e instanceof Error ? e.message : e}`);
    exitCode = 1;
  }

  console.log('');
  console.log(exitCode === 0 ? 'Resultado: OK (facturación operativa)' : 'Resultado: FALLÓ — revisar Hub / AFIP');
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
