import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    env: {
      // Supabase client initialises at module load time; provide stubs so
      // pure-unit tests (no real network calls) don't throw "supabaseUrl required".
      NEXT_PUBLIC_SUPABASE_URL: 'https://stub.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon-key',
    },
  },
})
