/**
 * Inspecciona .env.local para ver qué hay realmente en el archivo.
 * Uso: node scripts/inspect-env.js
 *
 * Muestra el contenido (valores enmascarados) para diagnosticar por qué
 * RESEND_API_KEY no se detecta aunque crees que está.
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');

console.log('📂 Raíz del proyecto:', root);
console.log('📄 Archivo:', envPath);
console.log('📄 Existe:', fs.existsSync(envPath));
console.log('');

// Listar archivos que parecen .env*
try {
  const files = fs.readdirSync(root);
  const envFiles = files.filter((f) => f.startsWith('.env') || f.includes('env'));
  console.log('📋 Archivos tipo env en raíz:', envFiles.join(', ') || '(ninguno)');
  console.log('');
} catch (e) {
  console.log('No se pudo listar directorio:', e.message);
}

if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local no existe. ¿Creaste el archivo en la raíz de legalmev-main?');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const lines = raw.split(/\r\n|\r|\n/);

console.log('📝 Contenido de .env.local (valores enmascarados):');
console.log('─'.repeat(60));

lines.forEach((line, i) => {
  const lineNum = (i + 1).toString().padStart(2);
  if (line.trim() === '') {
    console.log(lineNum + ' | (línea vacía)');
    return;
  }
  if (line.trim().startsWith('#')) {
    console.log(lineNum + ' | ' + line);
    return;
  }
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) {
    console.log(lineNum + ' | ' + line + '  ⚠️ sin =');
    return;
  }
  const key = line.substring(0, eqIndex).trim();
  const value = line.substring(eqIndex + 1).trim();
  const masked = value.length > 4 ? value.substring(0, 4) + '***' : '***';
  const hasResend = key.toUpperCase().includes('RESEND');
  console.log(lineNum + ' | ' + key + '=' + masked + (hasResend ? '  ✓ tiene RESEND' : ''));
});

console.log('─'.repeat(60));

// Buscar RESEND y DLOCAL
const resendLines = lines.filter((l) => l.includes('RESEND') || l.includes('resend'));
const dlocalLines = lines.filter((l) => l.toUpperCase().includes('DLOCAL'));
console.log('');
console.log('🔍 RESEND:', resendLines.length ? '✓ encontrado' : '❌ NO está');
console.log('🔍 DLocal:', dlocalLines.length ? `✓ ${dlocalLines.length} vars` : '❌ NO está');
const hasDlocalApi = lines.some((l) => /^DLOCAL_API_KEY\s*=/i.test(l.trim()));
const hasDlocalSecret = lines.some((l) => /^DLOCAL_SECRET_KEY\s*=/i.test(l.trim()));
if (!hasDlocalApi || !hasDlocalSecret) {
  console.log('');
  console.log('⚠️ DLocal: para probar pagos en local necesitás en .env.local:');
  if (!hasDlocalApi) console.log('   DLOCAL_API_KEY=tu-api-key-sandbox');
  if (!hasDlocalSecret) console.log('   DLOCAL_SECRET_KEY=tu-secret-sandbox');
  console.log('   Luego reiniciá: npm run dev');
}
if (resendLines.length === 0) {
  console.log('');
  console.log('   La variable RESEND_API_KEY NO está en este archivo.');
  console.log('   Verificá que estés editando el .env.local de legalmev-main.');
}
