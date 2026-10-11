import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'src/core/api/bambuddy.gen.ts', 'public/mockServiceWorker.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Regel 3: Module greifen nicht direkt auf fetch zu (siehe docs/ARCHITEKTUR.md).
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Bambuddy nur über @/core/api ansprechen.' }],
    },
  },
  {
    // Regel 2: Module importieren nie aus anderen Modulen.
    files: ['src/modules/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/modules/*', '../../*/**'], message: 'Module importieren nie aus anderen Modulen – nur über @/core.' }] },
      ],
    },
  },
  {
    // Der Kern darf fetch benutzen.
    files: ['src/core/**/*.{ts,tsx}', 'mocks/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: { globals: globals.node },
  },
);
