import nextConfig from 'eslint-config-next'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettierConfig from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**'] },

  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      // TypeScript: no `any`, warn on unused (allow _prefixed)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // React: not needed with new JSX transform
      'react/display-name': 'off',
      // Chinese text with quotation marks is intentional; relax to warn
      'react/no-unescaped-entities': 'warn',
    },
  },

  // Must be last — disables ESLint formatting rules that conflict with Prettier
  prettierConfig,
]

export default config
