/**
 * Sustituye URLs por defecto de jsDelivr en bundles vendored (tesseract.js).
 * En runtime MPBA ya se usan chrome.runtime.getURL(...); esto evita falsos positivos en escaneos.
 * Ejecutar tras copiar/actualizar lib/tesseract.min.js o lib/worker.min.js.
 */
const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '..', 'lib');
const files = ['tesseract.min.js', 'worker.min.js'];
/** RFC 6761: no resuelve DNS; evita escaneos y descarga remota si un fallback se ejecutara por error. */
const FROM = 'https://cdn.jsdelivr.net';
const TO = 'https://legalmev-extension.invalid';

for (const name of files) {
  const fp = path.join(libDir, name);
  if (!fs.existsSync(fp)) {
    console.warn('Omitido (no existe):', name);
    continue;
  }
  const s = fs.readFileSync(fp, 'utf8');
  if (!s.includes(FROM)) {
    console.log('Sin cambios (sin jsDelivr):', name);
    continue;
  }
  const n = s.split(FROM).length - 1;
  const out = s.split(FROM).join(TO);
  fs.writeFileSync(fp, out, 'utf8');
  console.log('Parche anti-CDN aplicado:', name, '(' + n + ' reemplazos)');
}
