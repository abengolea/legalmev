import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/.cursor/**',
      '**/.firebase/**',
      '**/*.min.js',
      'buscafallosscba/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
