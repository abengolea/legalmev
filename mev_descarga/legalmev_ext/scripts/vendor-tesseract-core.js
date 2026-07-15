/**
 * Copia solo el núcleo Tesseract usado en Chrome moderno (simd+lstm) a lib/tesseract-core.
 * Uso: npm install && node scripts/vendor-tesseract-core.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules', 'tesseract.js-core');
const dst = path.join(root, 'lib', 'tesseract-core');

if (!fs.existsSync(src)) {
  console.error('Falta node_modules/tesseract.js-core. Ejecutá: npm install tesseract.js-core@5.0.0 --save-dev');
  process.exit(1);
}

const PREFIX = 'tesseract-core-simd-lstm';
const ok = (f) =>
  f.startsWith(PREFIX) &&
  (f.endsWith('.js') || f.endsWith('.wasm') || f.endsWith('.wasm.js'));

fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) {
  if (!ok(f)) continue;
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
console.log('Copiado tesseract.js-core (solo ' + PREFIX + ') → lib/tesseract-core');
