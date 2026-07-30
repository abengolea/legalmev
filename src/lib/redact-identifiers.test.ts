import assert from 'node:assert/strict';
import { redactSensitiveIdentifiers, REDACT_PLACEHOLDER } from './redact-identifiers';

function run() {
  const sample = `
PEREZ, Juan Carlos, DNI 12.345.678, CUIT 20-12345678-9, con domicilio en Calle Falsa 123, piso 2,
CP 2900, email juan.perez@estudio.com, tel 011 4567-8901, Matrícula T° XII F° 345.
El actor RECLAMA daños. Expte. N° 12345/2024. Fecha 15/03/2024.
`.trim();

  const out = redactSensitiveIdentifiers(sample);

  assert.ok(out.includes('PEREZ, Juan Carlos'), 'conserva el nombre');
  assert.ok(out.includes('RECLAMA daños'), 'conserva hechos');
  assert.ok(out.includes('12345/2024') || out.includes('Expte'), 'conserva nro de expediente');
  assert.ok(!out.includes('12.345.678'), 'quita DNI');
  assert.ok(!out.includes('20-12345678-9'), 'quita CUIT');
  assert.ok(!out.includes('Calle Falsa'), 'quita calle');
  assert.ok(!out.includes('juan.perez@estudio.com'), 'quita email');
  assert.ok(!/\bT[°º]/.test(out) || out.includes(REDACT_PLACEHOLDER.matricula), 'quita matrícula');
  assert.ok(out.includes(REDACT_PLACEHOLDER.dni), 'placeholder DNI');

  const tomoDemanda = redactSensitiveIdentifiers('Ver Tomo de la demanda y Folio útil.');
  assert.ok(tomoDemanda.includes('Tomo de la demanda'), 'no rompe “Tomo de la demanda”');
  assert.ok(tomoDemanda.includes('Folio útil'), 'no rompe “Folio útil” suelto');

  const again = redactSensitiveIdentifiers(out);
  assert.equal(again, out, 'idempotente');

  console.log('ok: redact-identifiers');
}

run();
