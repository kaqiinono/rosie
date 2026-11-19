#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseEnv, promisify } from 'node:util'
import { getBackupBaiduAccount } from './lib/baidu-backup-account.mjs'
import {
  ensureProjectDirectory, listProjectDirectoryPage, putProjectObject, removeProjectObject, sha256,
} from '../apps/web/src/lib/baidu-project-transfer.mjs'

const project = 'yvukypevtqblhjdhkatb'
const destination = '/airosie/backup/supabase'
const root = resolve(import.meta.dirname, '..')
const localEnv = await readFile(resolve(root, 'apps/web/.env.local'), 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw Error('backup_local_configuration_unreadable')
  return ''
})
const env = { ...parseEnv(localEnv), ...process.env }
env.NEXT_PUBLIC_SUPABASE_URL ??= `https://${project}.supabase.co`
const command = process.argv[2] ?? 'backup'
const archivePattern = /^rosie-supabase-(\d{8}T\d{9}Z)-[a-f0-9]{8}\.tar\.gz(\.sha256)?$/
const run = promisify(execFile)

async function retry(task) {
  for (let attempt = 0; ; attempt++) {
    try { return await task() }
    catch (error) {
      if (attempt === 2 || error.message.includes('conflict') || error.message.includes('uncertain')) throw error
      await delay(2000 * (attempt + 1))
    }
  }
}

async function archiveConfiguration() {
  let url
  try {
    const pooler = env.SUPABASE_BACKUP_POOLER_URL ||
      (await readFile(resolve(root, 'supabase/.temp/pooler-url'), 'utf8')).trim()
    url = new URL(pooler)
  } catch {
    throw Error('backup_session_pooler_missing_or_invalid')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.pooler.supabase.com') ||
    url.port !== '5432' || decodeURIComponent(url.username) !== `rosie_backup.${project}` ||
    url.pathname !== '/postgres' || url.password || url.hash || (url.search && url.search !== '?sslmode=require')) {
    throw Error('backup_session_pooler_must_be_rosie_passwordless')
  }
  const password = env.SUPABASE_BACKUP_DB_PASSWORD
  if (!password) throw Error('backup_database_password_missing')
  return { PGHOST: url.hostname, PGPORT: url.port, PGUSER: decodeURIComponent(url.username),
    PGDATABASE: 'postgres', PGSSLMODE: 'require', PGPASSWORD: password }
}

const managedSchemas = [
  'information_schema', 'pg_*', '_analytics', '_realtime', '_supavisor', 'auth', 'etl',
  'extensions', 'pgbouncer', 'realtime', 'storage', 'supabase_functions', 'supabase_migrations',
  'cron', 'dbdev', 'graphql', 'graphql_public', 'net', 'pgmq', 'pgsodium', 'pgsodium_masks',
  'pgtle', 'repack', 'tiger', 'tiger_data', 'timescaledb_*', '_timescaledb_*', 'topology', 'vault',
]
const managedDataSchemas = [
  'information_schema', 'pg_*', 'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks',
  'pgtle', 'repack', 'tiger', 'tiger_data', 'timescaledb_*', '_timescaledb_*', 'topology',
  'vault', 'etl', 'extensions', 'pgbouncer', 'realtime', 'supabase_migrations', '_analytics', '_realtime', '_supavisor',
]
const excludeSchemas = schemas => schemas.flatMap(schema => ['--exclude-schema', schema])
const dataExclusions = ['auth.schema_migrations', 'storage.migrations', 'supabase_functions.migrations',
  'storage.buckets_vectors', 'storage.vector_indexes'].flatMap(table => ['--exclude-table', table])

const dumps = [
  ['roles-reference.sql', 'pg_dumpall', ['--roles-only', '--no-role-passwords']],
  ['schema.sql', 'pg_dump', ['--schema-only', '--no-owner', ...excludeSchemas(managedSchemas)]],
  ['data.sql', 'pg_dump', ['--data-only', ...excludeSchemas(managedDataSchemas), ...dataExclusions]],
  ['migration-history-schema.sql', 'pg_dump', ['--schema-only', '--no-owner', '--schema', 'supabase_migrations']],
  ['migration-history-data.sql', 'pg_dump', ['--data-only', '--schema', 'supabase_migrations']],
  ['auth-schema-reference.sql', 'pg_dump', ['--schema-only', '--schema', 'auth']],
  ['storage-schema-reference.sql', 'pg_dump', ['--schema-only', '--schema', 'storage']],
  ['vault-data.sql', 'pg_dump', ['--data-only', '--schema', 'vault']],
]

async function createArchive(directory, archiveName, createdAt) {
  const config = await archiveConfiguration()
  const dockerEnv = Object.keys(config).flatMap(name => ['--env', name])
  const identity = `${process.getuid()}:${process.getgid()}`
  for (const [name, binary, flags] of dumps) {
    const output = join(directory, name)
    await retry(async () => {
      await rm(output, { force: true })
      try {
        await run('docker', ['run', '--rm', '--user', identity, '--volume', `${directory}:/backup`,
          ...dockerEnv, 'postgres:17.9-bookworm', binary, '--quote-all-identifiers',
          '--file', '/backup/' + name, ...flags], {
          env: { ...process.env, ...config }, timeout: 8 * 60_000, maxBuffer: 1024 * 1024,
        })
      } catch (error) {
        if (error.code === 'ENOENT') throw Error('backup_docker_missing')
        // Never print PostgreSQL/Docker output, which can include connection information.
        const log = error.stderr ?? ''
        const detail = /authentication failed|tenant or user not found/i.test(log) ? '_authentication'
          : /permission denied/i.test(log) ? '_permission' : /does not exist/i.test(log) ? '_missing_object' : ''
        throw Error(`backup_dump_${name.replace(/\.sql$/, '')}${detail}`)
      }
      if (!(await stat(output)).size) throw Error('backup_dump_empty')
    })
    console.log(`Exported ${name}`)
  }

  const parts = dumps.map(([name]) => name)
  const manifest = {
    project, createdAt, archiveName, format: 'rosie-supabase-logical-v1',
    sourceCommit: env.GITHUB_SHA ?? null,
    files: [],
  }
  for (const name of parts) {
    const bytes = await readFile(join(directory, name))
    manifest.files.push({ name, bytes: bytes.length, sha256: sha256(bytes) })
  }
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  const archive = join(directory, archiveName)
  await run('tar', ['-czf', archive, '-C', directory, ...parts, 'manifest.json'])
  return readFile(archive)
}

function parseBackup(entry) {
  const name = entry.path?.slice(destination.length + 1)
  const match = entry.isdir === 0 && entry.path === `${destination}/${name}` && archivePattern.exec(name)
  if (!match) return null
  const stamp = match[1]
  const time = Date.parse(`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(9,11)}:${stamp.slice(11,13)}:${stamp.slice(13,15)}.${stamp.slice(15,18)}Z`)
  return Number.isFinite(time) ? { path: entry.path, time, marker: !!match[2] } : null
}

async function listBackups(token) {
  const backups = []
  for (let offset = 0; ; offset += 1000) {
    const entries = await listProjectDirectoryPage(token, destination, offset)
    backups.push(...entries.map(parseBackup).filter(Boolean))
    if (entries.length < 1000) return backups
  }
}

async function backup() {
  const createdAt = new Date().toISOString()
  const name = `rosie-supabase-${createdAt.replace(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}.tar.gz`
  const directory = await mkdtemp(join(tmpdir(), 'rosie-supabase-backup-'))
  try {
    const bytes = await createArchive(directory, name, createdAt)
    const account = await retry(() => getBackupBaiduAccount(env))
    const { token } = account
    const target = `${destination}/${name}`
    const hash = sha256(bytes)
    await retry(() => ensureProjectDirectory(token, destination))
    await retry(() => putProjectObject(token, target, bytes, { verify: true }))
    if ((await getBackupBaiduAccount(env)).generation !== account.generation) throw Error('backup_baidu_account_changed')
    const marker = new TextEncoder().encode(`${hash}  ${name}\n`)
    await retry(() => putProjectObject(token, target + '.sha256', marker, { verify: true }))
    console.log(`Verified Baidu backup ${name} (${bytes.length} bytes, sha256 ${hash})`)

    const cutoff = Date.now() - 30 * 86400_000
    const expired = (await retry(() => listBackups(token))).filter(entry => entry.time < cutoff)
    // Remove success markers before their archives; a stale marker must never imply recovery.
    expired.sort((a, b) => Number(b.marker) - Number(a.marker))
    for (const entry of expired) {
      await retry(() => removeProjectObject(token, entry.path))
    }
    if (expired.length) console.log(`Removed ${expired.length} expired backup files and markers`)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function check() {
  const { token } = await retry(() => getBackupBaiduAccount(env))
  const backups = await retry(() => listBackups(token))
  const files = new Set(backups.filter(entry => !entry.marker).map(entry => entry.path))
  const stamps = backups.filter(entry => entry.marker && files.has(entry.path.slice(0, -'.sha256'.length)))
    .map(entry => entry.time)
  const latest = Math.max(-Infinity, ...stamps.filter(stamp => stamp <= Date.now()))
  if (Date.now() - latest > 30 * 60 * 60_000) throw Error('backup_no_verified_copy_in_30_hours')
  console.log(`Latest verified backup: ${new Date(latest).toISOString()}`)
}

process.umask(0o077)
try {
  if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw Error('unexpected_supabase_project')
  if (command === 'backup' && process.argv.length <= 3) await backup()
  else if (command === 'check' && process.argv.length === 3) await check()
  else throw Error('usage_node_scripts_supabase-backup_mjs_backup_or_check')
} catch (error) {
  const message = error instanceof Error ? error.message : ''
  console.error(/^[a-zA-Z0-9_-]+$/.test(message) ? message : 'backup_unavailable')
  process.exitCode = 1
}
