import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'dist-electron/**', 'release/**', 'resources/**', 'test-results/**', 'playwright-report/**', 'scripts/*.mjs'] },
  js.configs.recommended,
  prettier,
  {
    // TS-файлы проверяет tsc (strict); typescript-eslint@8 ещё не поддерживает TS 7.
    files: ['**/*.{cjs,mjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 2024, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
