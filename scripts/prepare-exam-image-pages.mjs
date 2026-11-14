#!/usr/bin/env node
// Prepare the existing scanned pages for the admin-only crop workspace.
// --apply uploads temporary originals; --restore explicitly restores retired originals.
// Never exposes scans through public/. Does not publish exam content.
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
if (args.some(arg => !['--apply', '--restore'].includes(arg)) || (args.includes('--restore') && !args.includes('--apply'))) {
  throw new Error('Usage: node scripts/prepare-exam-image-pages.mjs [--apply [--restore]]')
}
const root = fileURLToPath(new URL('../', import.meta.url))
const apply = args.includes('--apply'), restore = args.includes('--restore')
const env = { ...parseEnv(await readFile(resolve(root, 'apps/web/.env.local'), 'utf8').catch(() => '')), ...process.env }
const origin = env.NEXT_PUBLIC_SUPABASE_URL, token = env.SUPABASE_SERVICE_ROLE_KEY
if (apply && (!origin || !token)) throw new Error('Supabase server configuration is required for --apply')
async function request(path, init = {}) {
  const response = await fetch(new URL(path, origin), { ...init, signal: AbortSignal.timeout(90_000), redirect: 'error',
    headers: { apikey: token, Authorization: `Bearer ${token}`, ...init.headers } })
  if (!response.ok) throw new Error(`Source upload request failed (${response.status}); no credentials or response content logged.`)
  return response
}
const bundles = ['ket-official-four-tests/test-1-full', 'ket-trainer-1/test-3-full',
  'ket-trainer-1/test-1-rw-part1-training', 'ket-trainer-1/test-1-listening-part1-training']
const pages = {}
for (const bundle of bundles) {
  const directory = resolve(root, 'packages/exams/source-data', bundle)
  const content = JSON.parse(await readFile(resolve(directory, 'content.json'), 'utf8'))
  const set = JSON.parse(await readFile(resolve(directory, 'content-set.json'), 'utf8'))
  for (const slot of content.mediaSlots.filter(slot => slot.purpose === 'question_image')) {
    for (const source of slot.provenance.sources) {
      const key = `${source.sourceId}:${source.pdfPage}:${set.source.fileHash}`
      if (pages[key]) continue
      const page = String(source.pdfPage).padStart(3, '0')
      const input = source.sourceId === 'ket-official-four-tests'
        ? `output/exams/source-reading/official-test-1-full/page-${page}.png`
        : source.pdfPage <= 30 ? `output/exams/source-reading/trainer-training/page-${page}.png`
        : `output/exams/ket-trainer-1/test-3-full-review/${source.pdfPage === 209 ? 'speaking-card' : 'exam'}-${page}.png`
      const bytes = await readFile(resolve(root, input))
      const row = { id: key, source_id: source.sourceId, pdf_page: source.pdfPage, source_file_hash: set.source.fileHash,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        object_path: `${source.sourceId}/${set.source.fileHash}/page-${page}.png`,
        width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), state: 'ready' }
      pages[key] = row
      if (!apply) continue
      const params = new URLSearchParams({ id: `eq.${key}`, select: 'sha256,state' })
      const existing = await (await request(`/rest/v1/exam_image_source_pages?${params}`)).json()
      if (existing[0] && existing[0].sha256 !== row.sha256) throw new Error(`Source changed: ${source.sourceId} page ${page}`)
      if (existing[0]?.state === 'deleting' && restore) throw new Error('Finish pending source cleanup before restoring pages.')
      if (existing[0] && (!restore || existing[0].state === 'ready')) {
        console.log(`${source.sourceId} page ${page}: ${existing[0].state}; unchanged`)
        continue
      }
      if (restore && existing[0]) row.object_path = `${source.sourceId}/${set.source.fileHash}/page-${page}-${randomUUID()}.png`
      const object = row.object_path.split('/').map(encodeURIComponent).join('/')
      // Same prepared source identity and bytes; upsert also recovers interrupted first uploads.
      await request(`/storage/v1/object/exam-image-sources/${object}`, { method: 'POST', body: bytes,
        headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' } })
      await request('/rest/v1/exam_image_source_pages?on_conflict=id', { method: 'POST', body: JSON.stringify(row),
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' } })
      console.log(`${source.sourceId} page ${page}: uploaded`)
    }
  }
}
const output = resolve(root, 'output/exams/image-sources')
await mkdir(output, { recursive: true, mode: 0o700 })
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(pages, null, 2) + '\n', { mode: 0o600 })
if (apply) {
  // Remove only the temporary server-bundle copies made by the earlier preparation step.
  // Original user PDFs and source-reading renders remain untouched.
  for (const row of Object.values(pages)) {
    const local = resolve(root, 'apps/web/private/exams', `${row.source_id}-${String(row.pdf_page).padStart(3, '0')}.png`)
    await unlink(local).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
  await unlink(resolve(root, 'apps/web/private/exams/manifest.json')).catch(error => { if (error.code !== 'ENOENT') throw error })
}
console.log(`${apply ? 'Prepared private storage for' : 'Prepared manifest for'} ${Object.keys(pages).length} source pages.`)
