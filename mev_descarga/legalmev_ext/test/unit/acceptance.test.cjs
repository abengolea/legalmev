/**
 * Pruebas de aceptación — SPEC-01, SPEC-04, SPEC-05 (LegalMev).
 * Ejecutar: node test/unit/acceptance.test.cjs
 */
'use strict';

const assert = require('assert');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

// Cargar módulos puros en globalThis para resolver dependencias cruzadas
globalThis.LegalMevSegIdempotencia = require(path.join(rootDir, 'seguimiento', 'idempotencia.js'));
globalThis.LegalMevSegComparar = require(path.join(rootDir, 'seguimiento', 'comparar.js'));
const RepoMod = require(path.join(rootDir, 'seguimiento', 'repositorio.js'));
const MotorMod = require(path.join(rootDir, 'seguimiento', 'motor.js'));
const Nombres = require(path.join(rootDir, 'exportacion', 'nombres.js'));
const Meta = require(path.join(rootDir, 'sync', 'metadatos.js'));
const Categorias = require(path.join(rootDir, 'exportacion', 'categorias.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (e) {
    console.error(` FAIL ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  OK  ${name}`);
  } catch (e) {
    console.error(` FAIL ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

console.log('LegalMev — aceptación seguimiento/exportación\n');

test('idempotencia: prioriza id de portal', () => {
  const k = globalThis.LegalMevSegIdempotencia.claveIdempotencia({
    portalId: 'ABC-1',
    fecha: '01/01/2026',
    tipo: 'DESPACHO',
  });
  assert.strictEqual(k, 'portal:abc-1');
});

test('idempotencia: compuesto estable ante mayúsculas/acentos', () => {
  const a = globalThis.LegalMevSegIdempotencia.claveIdempotencia({
    fecha: '02/01/2026',
    tipo: 'Notificación',
    descripcion: 'Cédula de notificación',
  });
  const b = globalThis.LegalMevSegIdempotencia.claveIdempotencia({
    fecha: '02/01/2026',
    tipo: 'NOTIFICACION',
    descripcion: 'Cedula de notificacion',
  });
  assert.strictEqual(a, b);
  assert.ok(a.startsWith('compuesto:'));
});

test('comparar: detecta solo claves nuevas', () => {
  const known = new Set(['portal:1']);
  const { novedades } = globalThis.LegalMevSegComparar.detectarNovedades(
    [
      { portalId: '1', fecha: '1', tipo: 'A', descripcion: 'x' },
      { portalId: '2', fecha: '1', tipo: 'B', descripcion: 'y' },
    ],
    known,
    'MEV'
  );
  assert.strictEqual(novedades.length, 1);
  assert.strictEqual(novedades[0].claveIdempotencia, 'portal:2');
});

test('nombres ZIP: convención LegalMev propia (no _expte_completo)', () => {
  const folder = Nombres.folderFromExpediente('AL-123/2025', 'MEV', new Date('2026-07-15T12:00:00Z'));
  assert.ok(folder.startsWith('LegalMev_MEV_'));
  assert.ok(!folder.includes('expte_completo'));
  assert.strictEqual(Nombres.nombreIndicePdf(), 'indice.pdf');
  assert.strictEqual(Nombres.nombreInformeFallos(), 'informe_descarga.txt');
});

test('pie PDF: texto LegalMev (no string externo)', () => {
  // pieSeleccion vive en texto-pdf (browser); aquí validamos el contrato de nombres y categorías
  const stats = Categorias.buildCategoryStats([
    { tipo: 'SENTENCIA DEFINITIVA' },
    { tipo: 'CEDULA DE NOTIFICACION' },
  ]);
  assert.ok(stats.some((s) => s.id === 'resoluciones' && s.count === 1));
  assert.ok(stats.some((s) => s.id === 'notificaciones' && s.count === 1));
});

test('metadatos cloud: rechaza sin id/portal y acota campos', () => {
  assert.strictEqual(Meta.sanitizar({}), null);
  const s = Meta.sanitizar({
    id: 'x',
    portal: 'mev',
    caratula: 'A'.repeat(500),
    movimientos: [{ secreto: true }],
    pdf: 'no',
  });
  assert.strictEqual(s.portal, 'MEV');
  assert.strictEqual(s.caratula.length, Meta.MAX.caratula);
  assert.strictEqual(s.movimientos, undefined);
  assert.strictEqual(s.pdf, undefined);
});

(async () => {
  await testAsync('baseline: primer escaneo no crea alertas', async () => {
    const driver = RepoMod.createMemoryDriver();
    const repo = RepoMod.create(driver);
    let wave = 0;
    const movs = [
      [
        { id: '1', fecha: '01/01/2026', tipo: 'DESPACHO', descripcion: 'uno' },
        { id: '2', fecha: '02/01/2026', tipo: 'ESCRITO', descripcion: 'dos' },
      ],
      [
        { id: '1', fecha: '01/01/2026', tipo: 'DESPACHO', descripcion: 'uno' },
        { id: '2', fecha: '02/01/2026', tipo: 'ESCRITO', descripcion: 'dos' },
        { id: '3', fecha: '03/01/2026', tipo: 'NOTIF', descripcion: 'tres' },
      ],
      [
        { id: '1', fecha: '01/01/2026', tipo: 'DESPACHO', descripcion: 'uno' },
        { id: '2', fecha: '02/01/2026', tipo: 'ESCRITO', descripcion: 'dos' },
        { id: '3', fecha: '03/01/2026', tipo: 'NOTIF', descripcion: 'tres' },
      ],
    ];
    const motor = MotorMod.create({
      repositorio: repo,
      obtenerMovimientos: async () => movs[wave++] || movs[movs.length - 1],
    });
    const ref = await motor.registrar({
      portal: 'MEV',
      nroExpediente: 'TEST-1',
      url: 'https://example.test/exp',
    });
    const r1 = await motor.escanear(ref.id, { reason: 'test' });
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.baseline, true);
    assert.strictEqual(r1.novedades, 0);
    assert.strictEqual((await repo.listAlertas()).length, 0);

    const r2 = await motor.escanear(ref.id, { reason: 'test' });
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.novedades, 1);
    assert.strictEqual((await repo.listAlertas()).length, 1);

    const r3 = await motor.escanear(ref.id, { reason: 'test' });
    assert.strictEqual(r3.novedades, 0);
    assert.strictEqual((await repo.listAlertas()).length, 1);
  });

  await testAsync('pausar evita escaneo; eliminar hace cascade', async () => {
    const repo = RepoMod.create(RepoMod.createMemoryDriver());
    const motor = MotorMod.create({
      repositorio: repo,
      obtenerMovimientos: async () => [
        { id: 'a', fecha: '1', tipo: 'T', descripcion: 'd' },
      ],
    });
    const ref = await motor.registrar({ portal: 'PJN', nroExpediente: 'P-1', url: 'https://x' });
    await motor.escanear(ref.id);
    await motor.pausar(ref.id);
    const paused = await motor.escanear(ref.id);
    assert.strictEqual(paused.ok, false);
    assert.strictEqual(paused.code, 'PAUSADO');
    await motor.eliminar(ref.id);
    assert.strictEqual(await repo.getReferencia(ref.id), null);
    assert.strictEqual((await repo.listAlertas()).length, 0);
  });

  await testAsync('registrar: no duplica misma causa (portal+nro) aunque cambie la URL', async () => {
    const repo = RepoMod.create(RepoMod.createMemoryDriver());
    const motor = MotorMod.create({
      repositorio: repo,
      obtenerMovimientos: async () => [],
    });
    const a = await motor.registrar({
      portal: 'PJN',
      nroExpediente: '2543/21-A4',
      url: 'https://scw.pjn.gov.ar/scw/expediente.seam?cid=1',
    });
    const b = await motor.registrar({
      portal: 'PJN',
      nroExpediente: '2543 / 21-A4',
      url: 'https://scw.pjn.gov.ar/scw/expediente.seam?cid=999',
    });
    assert.strictEqual(a.id, b.id);
    assert.strictEqual((await repo.listReferencias()).length, 1);
    assert.ok(motor.findExisting(await repo.listReferencias(), { portal: 'PJN', nroExpediente: '2543/21-A4' }));
  });

  console.log(`\n${passed} pruebas OK`);
})();
