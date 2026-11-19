#!/usr/bin/env node
import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { getProjectStorageAccount } from '../lib/project-storage-account.mjs'
import {
  PROJECT_BUCKETS, PROJECT_ROOT, downloadProjectObject, projectPath, putProjectObject, removeProjectObject, sha256,
} from '../../apps/web/src/lib/baidu-project-transfer.mjs'

const { values: args } = parseArgs({ options: {
  copy: { type: 'boolean' },
  bucket: { type: 'string' },
  concurrency: { type: 'string', default: '4' },
  'purge-migrated': { type: 'boolean' },
  'purge-retired': { type: 'boolean' },
  'purge-standalone': { type: 'boolean' },
  'production-switched': { type: 'boolean' },
  receipt: { type: 'string' },
} })
const concurrency = Number(args.concurrency)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw Error('Concurrency must be between 1 and 12.')
const writes = [args.copy, args['purge-migrated'], args['purge-retired'], args['purge-standalone']].filter(Boolean).length
if (writes > 1 || ((args.copy || args['purge-migrated']) && !args.receipt) ||
  (args['purge-migrated'] && !args['production-switched'])) {
  throw Error('Copying or purging migrated files requires an absolute --receipt path. Purging migrated data also requires --production-switched.')
}
if (args.receipt && !args.receipt.startsWith('/')) throw Error('Use an absolute receipt path.')

const env = { ...parseEnv(await readFile(resolve(import.meta.dirname, '../../apps/web/.env.local'), 'utf8')), ...process.env }
const origin = 'https://yvukypevtqblhjdhkatb.supabase.co'
if (env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== origin || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw Error('Missing credentials for the Rosie production project.')
}
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const receiptPath = args.receipt
const readReceipt = async () => receiptPath
  ? (await readFile(receiptPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error }))
    .trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
const receipts = new Map((await readReceipt()).map(row => [`${row.account}/${row.bucket}/${row.path}`, row]))

async function request(path, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: 'error',
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw Error(`supabase_${method}_${response.status}`)
  return response
}

async function inventory(bucket, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += 500) {
    const response = await request(`/storage/v1/object/list/${bucket}`, 'POST', {
      prefix, offset, limit: 500, sortBy: { column: 'name', order: 'asc' },
    })
    const entries = await response.json()
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null && entry.metadata === null) files.push(...await inventory(bucket, path))
      else if (entry.id) files.push({ bucket, path, size: Number(entry.metadata?.size), version: entry.updated_at })
    }
    if (entries.length < 500) return files
  }
}

async function sourceBytes(file) {
  const path = file.path.split('/').map(encodeURIComponent).join('/')
  const response = await request(`/storage/v1/object/authenticated/${file.bucket}/${path}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!Number.isSafeInteger(file.size) || file.size !== bytes.length) throw Error('source_size_mismatch')
  return bytes
}

async function retry(action) {
  for (let attempt = 0; ; attempt++) {
    try { return await action() }
    catch (error) {
      if (attempt >= 3 || String(error.message).includes('conflict')) throw error
      await new Promise(resolve => setTimeout(resolve, 1500 * 2 ** attempt))
    }
  }
}

if (args.bucket && (!args.copy || !PROJECT_BUCKETS.includes(args.bucket))) throw Error('A supported --bucket can only be used with --copy.')
const buckets = args['purge-retired'] ? ['flipbook', 'raz'] : args['purge-standalone'] ? ['media'] : args.bucket ? [args.bucket] : PROJECT_BUCKETS
const purging = args['purge-migrated'] || args['purge-retired'] || args['purge-standalone']
const presentBuckets = []
let allFiles = []
for (const bucket of buckets) {
  if (purging) {
    const result = await request(`/storage/v1/bucket/${bucket}`).catch(error => {
      if (error.message === 'supabase_GET_404') return null
      throw error
    })
    if (!result) {
      console.log(`${bucket}: already removed`)
      continue
    }
  }
  presentBuckets.push(bucket)
  const files = await inventory(bucket)
  console.log(`${bucket}: ${files.length} objects, ${files.reduce((n, file) => n + file.size, 0)} bytes`)
  allFiles = allFiles.concat(files)
}

if (args.copy || args['purge-migrated']) {
  const account = await getProjectStorageAccount(env)
  let completed = 0
  let cursor = 0
  let failed = 0
  async function worker() {
    while (cursor < allFiles.length && failed < 8) {
      const index = cursor++
      const file = allFiles[index]
      const path = projectPath(file.bucket, file.path)
      try {
        const key = `${account.key}/${file.bucket}/${file.path}`
        const prior = receipts.get(key)
        const priorTarget = prior?.target ?? (file.bucket === 'chinese-reading-recordings' ? '' : path)
        const receipt = priorTarget === path ? prior : undefined
        const recorded = file.version && receipt?.version === file.version && receipt.size === file.size
        if (args.copy && !recorded) {
          const hash = await retry(async () => {
            const bytes = await sourceBytes(file)
            const hash = sha256(bytes)
            let overwrite = false
            if (receipt) {
              const existing = await downloadProjectObject(account.token, path)
              if (existing) {
                const remoteHash = sha256(new Uint8Array(await existing.arrayBuffer()))
                if (remoteHash === hash) return hash
                if (remoteHash !== receipt.hash) throw Error('baidu_project_path_conflict')
                overwrite = true
              }
            }
            await putProjectObject(account.token, path, bytes, { overwrite, verify: true })
            return hash
          })
          await appendFile(receiptPath, JSON.stringify({ ...file, account: account.key, target: path, hash }) + '\n', { mode: 0o600 })
        } else if (args['purge-migrated']) {
          if (!recorded) throw Error('source_not_in_verified_receipts')
          await retry(async () => {
            const [bytes, remote] = await Promise.all([sourceBytes(file), downloadProjectObject(account.token, path)])
            if (!remote || sha256(bytes) !== receipt.hash ||
              sha256(new Uint8Array(await remote.arrayBuffer())) !== receipt.hash) throw Error('cutover_hash_mismatch')
          })
        }
        completed++
        if (completed % 10 === 0 || completed === allFiles.length) console.log(`${completed}/${allFiles.length} verified`)
      } catch (error) {
        failed++
        const message = /^[a-z0-9_-]+$/i.test(error.message) ? error.message : 'provider_or_network_error'
        const site = error.stack?.split('\n').find(line => /(?:baidu-project-transfer|migrate-project-storage-to-baidu)\.mjs:\d+/.test(line))
          ?.match(/(?:baidu-project-transfer|migrate-project-storage-to-baidu)\.mjs:\d+/)?.[0]
        const kind = error.name || 'Error'
        const code = /^[A-Z_0-9]+$/.test(error.cause?.code ?? '') ? error.cause.code : ''
        console.error(`${file.bucket} object ${index + 1}/${allFiles.length}: ${message} ${kind} ${code} ${site ?? ''}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  if (failed || completed !== allFiles.length) throw Error(`${failed} failures. Re-run after resolving them.`)
  if ((await getProjectStorageAccount(env)).key !== account.key) throw Error('Shared Baidu authorization changed.')

  if (args['purge-migrated']) {
    for (const file of allFiles.filter(file => file.bucket === 'chinese-reading-recordings')) {
      const target = projectPath(file.bucket, file.path)
      const legacy = PROJECT_ROOT + target.slice((PROJECT_ROOT + '/record').length)
      const original = await downloadProjectObject(account.token, legacy)
      if (!original) continue
      const receipt = receipts.get(`${account.key}/${file.bucket}/${file.path}`)
      if (receipt?.hash !== sha256(new Uint8Array(await original.arrayBuffer()))) {
        throw Error('Legacy Chinese recording differs from the verified copy.')
      }
      await removeProjectObject(account.token, legacy)
    }
  }
}

if (purging) {
  if (args['purge-retired'] && allFiles.some(file => file.bucket === 'raz')) throw Error('raz is no longer empty.')
  for (const bucket of presentBuckets) {
    const snapshot = allFiles.filter(file => file.bucket === bucket)
    const expected = new Map(snapshot.map(file => [file.path, file.version]))
    const current = await inventory(bucket)
    if (current.length !== snapshot.length || current.some(file => expected.get(file.path) !== file.version)) {
      throw Error(`${bucket} inventory changed after listing.`)
    }
    for (let offset = 0; offset < snapshot.length; offset += 100) {
      await request(`/storage/v1/object/${bucket}`, 'DELETE', { prefixes: snapshot.slice(offset, offset + 100).map(file => file.path) })
    }
    if ((await inventory(bucket)).length) throw Error(`${bucket} still contains objects.`)
    await request(`/storage/v1/bucket/${bucket}`, 'DELETE')
    console.log(`${bucket}: removed`)
  }
}
