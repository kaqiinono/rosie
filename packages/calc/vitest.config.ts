import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  test: {
    environment: 'node',
    include: [
      'packages/calc/src/**/*.test.{ts,tsx}',
      'apps/web/tests/calc-*.test.{ts,tsx}',
    ],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
    },
  },
})
