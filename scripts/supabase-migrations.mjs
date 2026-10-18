#!/usr/bin/env node
// Run the Supabase CLI through this project's IPv4 session pooler.
// The direct database endpoint resets connections from this environment.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const command = process.argv[2] ?? 'list'
const commands = {
  list: ['migration', 'list'],
  'dry-run': ['db', 'push', '--dry-run', '--skip-vault'],
  push: ['db', 'push', '--skip-vault'],
}

if (!Object.hasOwn(commands, command) || process.argv.length > 3) {
  console.error('Usage: node scripts/supabase-migrations.mjs [list|dry-run|push]')
  process.exit(2)
}

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('SUPABASE_DB_PASSWORD is required. Enter it interactively; do not put it in command history.')
  process.exit(2)
}

let url
try {
  url = new URL(readFileSync(resolve(root, 'supabase/.temp/pooler-url'), 'utf8').trim())
} catch {
  console.error('Missing linked session pooler URL. Run supabase link for this project first.')
  process.exit(2)
}

const projectRef = readFileSync(resolve(root, 'supabase/.temp/project-ref'), 'utf8').trim()
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !url.hostname.endsWith('.pooler.supabase.com') ||
  url.port !== '5432' ||
  decodeURIComponent(url.username) !== `postgres.${projectRef}` ||
  url.password
) {
  console.error('The linked URL is not this project’s passwordless session pooler URL.')
  process.exit(2)
}

const result = spawnSync('supabase', [...commands[command], '--db-url', url.toString()], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PGPASSWORD: password },
})
if (result.error) {
  console.error(`Could not start Supabase CLI: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
