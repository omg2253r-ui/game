import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'apps/api/public/**', // built SPA copied in by build:single
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Studio code legitimately syncs props → state on id change.
      'react-hooks/set-state-in-effect': 'off',
      // The frontend must not reach into server code; share only via @3d-design/shared.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/api/**', '@3d-design/api*'],
              message: 'Use @3d-design/shared for code shared with the API.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/components/viewer/**/*.tsx'],
    rules: {
      // R3F JSX props (position, args, attach…) are not DOM attributes.
      'react/no-unknown-property': 'off',
      'react-hooks/immutability': 'off',
    },
  },
);
