#!/usr/bin/env node
// Lightweight forward-only migration runner for the Rosie Supabase database.
//
// Design (see supabase/README.md):
//   - Migrations live in supabase/migrations/NNNN_description.sql, applied in
//     filename order. Never edit an applied file; add a new higher-numbered one.
//   - Applied versions are tracked in the public.schema_migrations table.
//   - The runner shells out to `psql` (from libpq); no npm dependency is added.
//
// Usage (DATABASE_URL must be a direct/session-pooler Postgres URI, NOT the
// anon/service key — keep it out of git; pass it inline or via the environment):
//   DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs status
//   DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs up
//   DATABASE_URL=postgresql://... node scripts/apply-migrations.mjs baseline
//
// Commands:
//   status    Show applied vs pending migrations (no writes).
//   up        Apply every pending migration, each in its own transaction, and
//             record it in schema_migrations.
//   baseline  Mark ALL current migration files as applied WITHOUT running them.
//             Run this ONCE against an existing database whose schema already
//             matches 0001_baseline.sql, so `up` never re-runs the baseline.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations')

// Prefer libpq's psql (installed via `brew install libpq`) then fall back to PATH.
const PSQL_CANDIDATES = ['/opt/homebrew/opt/libpq/bin/psql', '/usr/local/opt/libpq/bin/psql', 'psql']

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: set DATABASE_URL to a Postgres connection URI (session pooler or direct).')
  process.exit(1)
}

function resolvePsql() {
  for (const cand of PSQL_CANDIDATES) {
    try {
      execFileSync(cand, ['--version'], { stdio: 'ignore' })
      return cand
    } catch {
      /* try next */
    }
  }
  console.error('ERROR: psql not found. Install with `brew install libpq`.')
  process.exit(1)
}
const PSQL = resolvePsql()

// Run SQL and return stdout (tuples-only, unaligned). Throws on error.
function psqlQuery(sql) {
  return execFileSync(PSQL, [DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tA', '-c', sql], {
    encoding: 'utf8',
  }).trim()
}

// Run a migration file wrapped in a single transaction, recording it atomically.
function psqlApplyFile(version, filePath) {
  assertSafeVersion(version)
  const wrapped = `BEGIN;\n\\i ${filePath}\nINSERT INTO public.schema_migrations (version) VALUES (${sqlQuote(version)});\nCOMMIT;\n`
  execFileSync(PSQL, [DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-q'], { input: wrapped, stdio: ['pipe', 'inherit', 'inherit'] })
}

function ensureTrackingTable() {
  psqlQuery(
    `CREATE TABLE IF NOT EXISTS public.schema_migrations (
       version text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     );`,
  )
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: f.replace(/\.sql$/, ''), file: f, path: join(MIGRATIONS_DIR, f) }))
}

// Versions are interpolated into SQL literals and a psql \i path, so they must
// never contain quotes or metacharacters. Enforce a strict whitelist even
// though the filename filter above already constrains the shape.
const VERSION_RE = /^\d{4}_[A-Za-z0-9._-]+$/
function assertSafeVersion(version) {
  if (!VERSION_RE.test(version)) {
    console.error(`ERROR: unsafe migration version "${version}" (allowed: NNNN_[A-Za-z0-9._-]).`)
    process.exit(1)
  }
}

// Escape a value for use inside a single-quoted SQL literal.
function sqlQuote(value) {
  return `'${value.replace(/'/g, "''")}'`
}

function appliedVersions() {
  const out = psqlQuery('SELECT version FROM public.schema_migrations ORDER BY version;')
  return new Set(out ? out.split('\n').filter(Boolean) : [])
}

const cmd = process.argv[2] ?? 'status'
ensureTrackingTable()
const all = migrationFiles()
for (const m of all) assertSafeVersion(m.version)
const applied = appliedVersions()
const pending = all.filter((m) => !applied.has(m.version))

if (cmd === 'status') {
  console.log(`migrations dir: ${MIGRATIONS_DIR}`)
  console.log(`applied: ${applied.size}   pending: ${pending.length}\n`)
  for (const m of all) console.log(`  [${applied.has(m.version) ? 'x' : ' '}] ${m.version}`)
} else if (cmd === 'baseline') {
  if (applied.size > 0) {
    console.log(`schema_migrations already has ${applied.size} row(s); nothing to baseline.`)
  } else {
    for (const m of all) psqlQuery(`INSERT INTO public.schema_migrations (version) VALUES (${sqlQuote(m.version)}) ON CONFLICT DO NOTHING;`)
    console.log(`marked ${all.length} migration(s) as applied without running them.`)
  }
} else if (cmd === 'up') {
  if (pending.length === 0) {
    console.log('nothing to apply; database is up to date.')
  } else {
    for (const m of pending) {
      process.stdout.write(`applying ${m.version} ... `)
      psqlApplyFile(m.version, m.path)
      console.log('ok')
    }
    console.log(`\napplied ${pending.length} migration(s).`)
  }
} else {
  console.error(`unknown command: ${cmd}. Use: status | up | baseline`)
  process.exit(1)
}
