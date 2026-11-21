#!/usr/bin/env node
import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { getProjectStorageAccount } from './lib/project-storage-account.mjs'
import {
  downloadProjectObject, ensureProjectDirectory, finishProjectUpload, isStoryIllustrationName, listProjectDirectoryPage,
  partHash, projectPath, sha256, startProjectUpload, uploadProjectPart,
} from '../apps/web/src/lib/baidu-project-transfer.mjs'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    work: { type: 'string' },
    concurrency: { type: 'string', default: '6' },
  },
})

const concurrency = Number(values.concurrency)
if (!values.work || !positionals.length || positionals.some((value) => !/^\d{1,2}$/.test(value))
  || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new Error('Usage: upload-story-ebook-art.mjs --work PATH [--concurrency 1–8] VOLUME...')
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function readReceipts(path) {
  const stored = await readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  return stored.split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

async function transfer(token, path, bytes, digest, existingId) {
  let id = existingId
  if (!id) {
    const hash = partHash(bytes)
    const plan = await startProjectUpload(token, path, bytes.length, [hash], false)
    if (plan) {
      for (const part of plan.missing) await uploadProjectPart(token, path, plan.uploadId, part, bytes, hash)
      id = await finishProjectUpload(token, path, bytes.length, [hash], false, plan.uploadId)
    }
  }
  const response = await downloadProjectObject(token, path, AbortSignal.timeout(40_000), id)
  if (!response || sha256(new Uint8Array(await response.arrayBuffer())) !== digest) {
    throw new Error(existingId ? 'story_art_path_conflict' : 'story_art_checksum_mismatch')
  }
}

function errorCode(error) {
  return error.errno ?? error.cause?.code ?? (
    /^(?:baidu_project|story_art)_\w+$/.test(error.message) ? error.message : 'story_art_upload_failed'
  )
}

const account = await getProjectStorageAccount(process.env)
let failures = 0
for (const volume of new Set(positionals.map((value) => value.padStart(2, '0')))) {
  const directory = resolve(values.work, volume)
  const { slug, files } = await readJson(resolve(directory, 'media.json'))
  if (!/^[a-z0-9-]+$/.test(slug) || !files.length || files.some(({ local, remote }) =>
    !/^\d{3}(?:-\d+)?\.webp$/.test(local) || !isStoryIllustrationName('dragon-masters', remote))) {
    throw new Error(`Unexpected media manifest for volume ${volume}`)
  }
  const prefix = projectPath('reading', `stories/dragon-masters/${slug}`)
  const receiptPath = resolve(directory, 'baidu-receipts.jsonl')
  const prior = new Map((await readReceipts(receiptPath))
    .filter((receipt) => receipt.account === account.key)
    .map((receipt) => [receipt.path, receipt.sha256]))
  await ensureProjectDirectory(account.token, prefix)
  const remote = new Map((await listProjectDirectoryPage(account.token, prefix, 0))
    .filter((file) => file.isdir === 0)
    .map((file) => [file.path, String(file.fs_id)]))
  let cursor = 0
  let completed = 0
  const failed = []
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < files.length) {
      const item = files[cursor++]
      const path = `${prefix}/${item.remote}`
      const bytes = await readFile(resolve(directory, 'art', item.local))
      const digest = sha256(bytes)
      try {
        const existing = remote.get(path)
        if (prior.get(path) !== digest || !existing) {
          for (let attempt = 0; ; attempt++) {
            try {
              await transfer(account.token, path, bytes, digest, existing)
              break
            } catch (error) {
              if (attempt >= 2 || error.message === 'story_art_path_conflict') throw error
              await delay(900 * 2 ** attempt)
            }
          }
          await appendFile(receiptPath, JSON.stringify({ account: account.key, path, sha256: digest }) + '\n')
        }
        completed++
      } catch (error) {
        failed.push(item.remote)
        console.error(`${volume}/${item.remote}: ${errorCode(error)}`)
      }
    }
  }))
  failures += failed.length
  console.log(`${volume} ${slug}: ${completed}/${files.length} read-back matches`)
}
process.exitCode = Number(failures > 0)
