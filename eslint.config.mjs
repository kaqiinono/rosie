import nextConfig from 'eslint-config-next'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettierConfig from 'eslint-config-prettier'

// Shared flat config for the @rosie/* library packages. Mirrors apps/web's config
// (eslint-config-next) so the same rule set — including @next/next/* and react-hooks/* —
// is defined; the package source has inline eslint-disable comments referencing those rules.
// apps/web has its own eslint.config.mjs and is ignored here; each package runs `eslint .`
// and ESLint walks up to find this root config.
/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', 'apps/**'] },

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

      // Relax newer next/react-hooks rules to warn — existing package code predates them:
      //  - empty interface (`interface X extends Y {}`) used as type aliases
      //  - setState in effect: the common "reset local state when a prop changes" pattern
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Must be last — disables ESLint formatting rules that conflict with Prettier
  prettierConfig,
]

export default config
