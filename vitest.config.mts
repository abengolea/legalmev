import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/control-prueba-v2/**/*.test.ts',
      'src/lib/audiencia-merge-testigos.test.ts',
    ],
    exclude: ['node_modules', '.next', 'mev_descarga'],
  },
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
    },
  },
});
