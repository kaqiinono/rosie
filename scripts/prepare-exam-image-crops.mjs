#!/usr/bin/env node
// Authoring operation, not a project check: crop configured regions and save real media.
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs, parseEnv } from 'node:util'
import { createJiti } from 'jiti'

const root = resolve(import.meta.dirname, '..')
const { values } = parseArgs({ options: {
  apply: { type: 'boolean' }, 'all-drafts': { type: 'boolean' }, revision: { type: 'string' }, actor: { type: 'string' },
} })
if (!values.apply || Boolean(values['all-drafts']) === Boolean(values.revision)) {
  throw new Error('Usage: node scripts/prepare-exam-image-crops.mjs --apply (--all-drafts | --revision <id>) [--actor <admin-user-id>]')
}
for (const filename of ['.env.local', '.env.proxy.local']) {
  const entries = parseEnv(await readFile(resolve(root, 'apps/web', filename), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''
    throw error
  }))
  for (const [key, value] of Object.entries(entries)) process.env[key] ??= value
}
const webRequire = createRequire(resolve(root, 'apps/web/package.json'))
const nextRequire = createRequire(webRequire.resolve('next/package.json'))
// Reuse the image encoder already supplied by Next; never install dependencies here.
const sharp = nextRequire('sharp')
const { createClient } = webRequire('@supabase/supabase-js')
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('exam_server_configuration_missing')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } })
const jiti = createJiti(import.meta.url, { fsCache: false, alias: {
  'server-only': resolve(root, 'scripts/lib/exams/serverOnly.mjs'),
  '@': resolve(root, 'apps/web/src'),
  '@rosie/core': resolve(root, 'packages/core/src/baiduErrors.ts'),
  '@rosie/exams/validation': resolve(root, 'packages/exams/src/validation/index.ts'),
} })
const { readExamImageWorkspace } = await jiti.import(resolve(root, 'apps/web/src/lib/exams/imageTasks.ts'))
const { readImageSource } = await jiti.import(resolve(root, 'apps/web/src/lib/exams/imageSources.ts'))
const { readExamMediaDraft } = await jiti.import(resolve(root, 'apps/web/src/lib/exams/media.ts'))
const { readImageCropRequest } = await jiti.import(resolve(root, 'apps/web/src/lib/exams/imageCropRequest.ts'))
const { saveExamImageCrop } = await jiti.import(resolve(root, 'apps/web/src/lib/exams/imageCrop.ts'))

async function actor() {
  const id = values.actor ?? process.env.EXAMS_ADMIN_USER_ID
  if (id) {
    const { data, error } = await db.auth.admin.getUserById(id)
    if (error || data.user?.app_metadata?.role !== 'admin') throw new Error('exam_admin_actor_required')
    return data.user.id
  }
  const admins = []
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error('exam_admin_actor_unavailable')
    admins.push(...data.users.filter(user => user.app_metadata?.role === 'admin'))
    if (data.users.length < 100) {
      if (admins.length !== 1) throw new Error('exam_explicit_admin_actor_required')
      return admins[0].id
    }
  }
  throw new Error('exam_explicit_admin_actor_required')
}
const actorId = await actor()
const output = resolve(root, 'output/exams/image-crops')
await mkdir(output, { recursive: true, mode: 0o700 })
const lockPath = resolve(output, '.lock')
try {
  const lock = await open(lockPath, 'wx', 0o600)
  await lock.writeFile(String(process.pid)); await lock.close()
} catch (error) {
  if (error.code === 'EEXIST') throw new Error('exam_crop_batch_locked: another run or an interrupted run owns output/exams/image-crops/.lock')
  throw error
}
let stop = false
process.on('SIGINT', () => { stop = true })
process.on('SIGTERM', () => { stop = true })
const totals = { saved: 0, bound: 0, noRegion: 0, noSource: 0, retired: 0, failed: 0 }
const hash = value => createHash('sha256').update(value).digest('hex')
const log = value => console.log(JSON.stringify(value))
async function checkpoint(path, state) {
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
  await rename(temporary, path)
}
try {
  let revisions = values.revision ? [values.revision] : []
  if (values['all-drafts']) {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await db.from('exam_content_revisions').select('id').eq('status', 'draft').order('id').range(offset, offset + 99)
      if (error) throw new Error('exam_draft_list_unavailable')
      revisions.push(...data.map(row => row.id))
      if (data.length < 100) break
    }
  }
  for (const revisionId of revisions) {
    if (stop) break
    let workspace = await readExamImageWorkspace(db, revisionId)
    const sourceCache = new Map()
    log({ revisionId, tasks: workspace.tasks.length, stage: 'starting' })
    for (const task of workspace.tasks) {
      if (stop) break
      const slotId = task.slot.id
      const key = hash(`${revisionId}\n${slotId}`)
      const statePath = resolve(output, `${key}.json`)
      let state
      try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (state && (state.actorId !== actorId || state.command.revisionId !== revisionId || state.command.slotId !== slotId)) throw new Error('exam_crop_checkpoint_identity_mismatch')
      if (task.retired) { totals.retired++; continue }
      if (state?.receipt) { totals.bound++; continue }
      // Reconcile an unfinished request before skipping a binding whose save reply was lost.
      if (!state && task.binding) { totals.bound++; continue }
      const region = task.source?.region
      if (!state && !region) { totals.noRegion++; log({ revisionId, slotId, stage: 'needs_manual_region' }); continue }
      if (!state && (!task.sourceAvailable || !task.sourceSha256)) { totals.noSource++; log({ revisionId, slotId, stage: 'needs_source_page' }); continue }
      try {
        let bytes
        if (state) {
          bytes = await readFile(resolve(output, `${key}.png`))
          if (hash(bytes) !== state.imageSha256) throw new Error('exam_crop_checkpoint_image_changed')
        } else {
          const record = await readExamMediaDraft(db, revisionId)
          const fileHash = record.draft.contentSet.source.fileHash
          const sourceKey = `${task.source.sourceId}:${task.source.pdfPage}:${fileHash}`
          if (!sourceCache.has(sourceKey)) sourceCache.set(sourceKey, await readImageSource(db, task.source, fileHash))
          const source = sourceCache.get(sourceKey)
          const { width, height } = source.asset
          const left = Math.round(region.x * width), top = Math.round(region.y * height)
          const cropWidth = Math.min(width - left, Math.round(region.width * width))
          const cropHeight = Math.min(height - top, Math.round(region.height * height))
          bytes = await sharp(source.bytes).extract({ left, top, width: cropWidth, height: cropHeight }).png().toBuffer()
          const command = { requestId: randomUUID(), revisionId, slotId, expectedVersion: workspace.version,
            expectedBindingRevisionId: workspace.bindingRevisionId, sourceSha256: source.asset.sha256, region }
          state = { actorId, mode: 'prepared-region', command, imageSha256: hash(bytes), receipt: null }
          await writeFile(resolve(output, `${key}.png`), bytes, { mode: 0o600 })
          await checkpoint(statePath, state)
        }
        // Apply the same upload contract as the browser; this is part of the write operation.
        const request = new Request('http://exam-authoring.local/crop', { method: 'POST', headers: {
          'Content-Type': 'image/png', 'X-Exam-Crop': JSON.stringify(state.command),
        }, body: bytes })
        const crop = await readImageCropRequest(request)
        log({ revisionId, slotId, stage: 'uploading', bytes: bytes.length })
        state.receipt = await saveExamImageCrop(db, actorId, crop.command, crop.bytes, crop.width, crop.height)
        await checkpoint(statePath, state)
        totals.saved++
        workspace = { ...workspace, version: state.receipt.version, bindingRevisionId: state.receipt.bindingRevisionId }
        log({ revisionId, slotId, stage: 'saved', completed: totals.saved })
        await unlink(resolve(output, `${key}.png`))
      } catch (error) {
        totals.failed++
        const code = typeof error?.code === 'string' ? error.code : error instanceof Error ? error.message : ''
        log({ revisionId, slotId, stage: 'stopped', error: /^[a-z][a-z0-9_]{0,99}$/.test(code) ? code : 'exam_crop_batch_failed' })
        // Preserve exact request + PNG for retry; do not advance after an unknown write result.
        stop = true
        process.exitCode = 1
        break
      }
    }
  }
  log({ stage: stop ? 'paused' : 'complete', ...totals, receipts: 'output/exams/image-crops' })
} finally {
  await unlink(lockPath)
}
