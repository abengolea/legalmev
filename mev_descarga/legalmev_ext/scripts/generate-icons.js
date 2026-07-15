#!/usr/bin/env node
/**
 * Genera iconos para la extensión Chrome LegalMEV.
 * Tamaños: 16, 32, 48, 128 px (fondo transparente, logo centrado).
 *
 * Uso:
 *   1. Colocar icon-base.png en mev_exporter_ext/icons/
 *   2. npm run generate-icons  (desde mev_exporter_ext)
 *
 * Si no existe icon-base.png, usa icon128.png como base.
 */

const fs = require('fs');
const path = require('path');

const EXT_ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(EXT_ROOT, 'icons');
const SIZES = [16, 32, 48, 128];

// Rutas posibles del icono base
const BASE_CANDIDATES = [
  path.join(ICONS_DIR, 'icon-base.png'),
  path.join(EXT_ROOT, 'icon-base.png'),
  path.join(ICONS_DIR, 'icon128.png'),
];

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('❌ Sharp no instalado. Ejecutá: npm install --save-dev sharp');
    process.exit(1);
  }

  // Crear carpeta icons si no existe
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    console.log('✓ Carpeta icons/ creada');
  }

  // Buscar icono base
  let basePath = null;
  for (const p of BASE_CANDIDATES) {
    if (fs.existsSync(p)) {
      basePath = p;
      break;
    }
  }

  if (!basePath) {
    console.error('❌ No se encontró icono base. Colocá icon-base.png en:');
    console.error('   ' + path.join(ICONS_DIR, 'icon-base.png'));
    process.exit(1);
  }

  console.log('📦 Base:', path.basename(basePath));

  // Cargar en buffer para evitar "same file input/output" cuando base es icon128
  const inputBuffer = fs.readFileSync(basePath);
  const image = sharp(inputBuffer);
  const meta = await image.metadata();
  const hasAlpha = meta.channels === 4 || meta.hasAlpha;

  if (!hasAlpha && path.basename(basePath) === 'icon128.png') {
    console.log('⚠️  icon128.png no tiene fondo transparente. Para mejor resultado, usá icon-base.png con alpha.');
  }

  for (const size of SIZES) {
    const outPath = path.join(ICONS_DIR, `icon${size}.png`);
    // Lanczos3 para mejor nitidez en downscale
    await sharp(inputBuffer)
      .resize(size, size, { kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`✓ icon${size}.png (${size}x${size})`);
  }

  console.log('\n✓ Iconos generados. Verificá en Chrome: chrome://extensions → LegalMev');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
