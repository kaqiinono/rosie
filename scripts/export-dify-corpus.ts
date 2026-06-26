#!/usr/bin/env node
/** @deprecated Implementation moved to export-dify-corpus-lib.ts; run via vitest. */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('pnpm', ['--filter', 'web', 'exec', 'vitest', 'run', 'tests/export-dify-corpus.test.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
