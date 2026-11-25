import 'server-only'

import { createAdminSupabase } from '../api-auth'
import { readTheaterSubtitleSource, readTheaterSubtitleBytes, decodeTheaterSubtitle, theaterSubtitleBindings,
  verifyTheaterSubtitleFilm, type TheaterSubtitleSource } from '../baidu-theater'
import { exactBaiduId } from '../baidu-identity'
import { readBaiduFileMetadata, type BaiduFileFingerprint } from '../baidu-media'
import { findProjectFile, putProjectObject, sha256 } from '../baidu-project-transfer.mjs'
import { maxSubtitleBytes, parseTheaterSubtitles, reviseTheaterSubtitle, sameSubtitleCue,
  spliceTheaterSubtitle } from './subtitle-timeline'
import {
  theaterSubtitleLanguages,
  type SubtitleTracks, type TheaterLanguage, type TheaterSubtitleChange,
  type TheaterSubtitleEdit, type TheaterSubtitleRevisionBatch, type TheaterSubtitleSplice,
  type TheaterSubtitles,
} from './types'

type Upload = { path: string; original: string; output: string }
type UploadPlan = Partial<Record<TheaterLanguage, Upload>>
type Batch = TheaterSubtitleRevisionBatch & { version: string; upload_plan: UploadPlan | null; lease_until: string | null }

const batchTable = () => createAdminSupabase().from('theater_subtitle_revision_batches')
const revisionFields = 'id,changes,synced_at,version,upload_plan,lease_until'
const historyPageSize = 10
const batchLeaseMs = 120_000

async function readPending(filmId: string) {
  const { data, error } = await batchTable().select(revisionFields).eq('film_id', filmId).is('synced_at', null).maybeSingle()
  if (error) throw error
  return data as Batch | null
}

function revisionVersion(source: TheaterSubtitleSource, pending: Batch | null) {
  return source.film.revision + ':' + (pending?.version ?? '')
}

function applyChanges(text: string, name: string, changes: TheaterSubtitleChange[], language: TheaterLanguage) {
  const corrections = new Map<number, string>()
  for (const change of changes) {
    if (change.language !== language) continue
    if ('kind' in change) {
      if (corrections.size) text = reviseTheaterSubtitle(text, name, corrections)
      corrections.clear()
      const cues = parseTheaterSubtitles(text, name, true)
      if (change.before.some((cue, offset) => {
        const actual = cues[change.index + offset]
        return !actual || !sameSubtitleCue(actual, cue)
      })) throw Error('theater_subtitle_source_conflict')
      text = spliceTheaterSubtitle(text, name, change.index, change.before.length, change.after)
    } else {
      corrections.set(change.index, change.text)
    }
  }
  return corrections.size ? reviseTheaterSubtitle(text, name, corrections) : text
}

async function sourceRequired(filmId: string) {
  const source = await readTheaterSubtitleSource(filmId)
  if (!source) throw Error('theater_subtitle_film_missing')
  return source
}

async function readBoundTrack(source: TheaterSubtitleSource, language: TheaterLanguage, signal: AbortSignal) {
  const binding = theaterSubtitleBindings(source.film, language)
  if (!binding) return null
  const bytes = await readTheaterSubtitleBytes(source.account, source.film.directory_path,
    binding.id, binding.name, binding.fingerprint, signal)
  const text = decodeTheaterSubtitle(bytes)
  return { binding, bytes, text }
}

export async function readTheaterEditedSubtitles(filmId: string, canEdit: boolean, signal: AbortSignal):
  Promise<TheaterSubtitles | null> {
  const source = await readTheaterSubtitleSource(filmId)
  if (!source) return null
  const pending = await readPending(filmId)
  const tracks: SubtitleTracks = {}
  const precision: NonNullable<TheaterSubtitles['editor']>['precision'] = {}
  await Promise.all(theaterSubtitleLanguages.map(async language => {
    const output = pending?.upload_plan?.[language]?.output
    const binding = theaterSubtitleBindings(source.film, language)
    if (!binding) return
    precision[language] = /\.ass$/i.test(binding.name) ? 10 : 1
    // A partially uploaded batch remains readable even if the original Baidu ID has changed.
    if (output) {
      tracks[language] = parseTheaterSubtitles(output, binding.name, true)
      return
    }
    const original = await readBoundTrack(source, language, signal)
    if (!original) return
    const text = applyChanges(original.text, binding.name, pending?.changes ?? [], language)
    tracks[language] = parseTheaterSubtitles(text, binding.name, true)
  }))
  return { tracks, canEdit, ...(canEdit ? { editor: { version: revisionVersion(source, pending), precision } } : {}) }
}

export async function readTheaterRevisionStatus(filmId: string, page: number) {
  await sourceRequired(filmId)
  const offset = page * historyPageSize
  const [pending, history] = await Promise.all([
    readPending(filmId),
    batchTable().select('id,changes,synced_at').eq('film_id', filmId).not('synced_at', 'is', null)
      .order('synced_at', { ascending: false }).order('id').range(offset, offset + historyPageSize),
  ])
  if (history.error) throw history.error
  return {
    pending: pending ? { id: pending.id, changes: pending.changes, synced_at: null } : null,
    syncStarted: !!pending?.upload_plan || !!pending?.lease_until && Date.parse(pending.lease_until) > Date.now(),
    history: (history.data as TheaterSubtitleRevisionBatch[]).slice(0, historyPageSize),
    hasMore: history.data.length > historyPageSize,
  }
}

export async function saveTheaterSubtitleEdits(filmId: string, userId: string,
  edits: (TheaterSubtitleEdit | TheaterSubtitleSplice)[], version: string | undefined, signal: AbortSignal) {
  const source = await sourceRequired(filmId)
  const pending = await readPending(filmId)
  if (pending?.upload_plan || pending?.lease_until && Date.parse(pending.lease_until) > Date.now())
    throw Error('theater_subtitle_sync_locked')
  if ((version && version !== revisionVersion(source, pending)) ||
      (!version && pending?.changes.some(change => 'kind' in change))) throw Error('theater_subtitle_source_conflict')
  const changes = [...(pending?.changes ?? [])]
  const changeCount = changes.length
  const now = new Date().toISOString()
  for (const language of theaterSubtitleLanguages) {
    const updates = edits.filter(edit => edit.language === language)
    if (!updates.length) continue
    const track = await readBoundTrack(source, language, signal)
    if (!track) throw Error('theater_subtitle_source_conflict')
    const original = applyChanges(track.text, track.binding.name, changes, language)
    const cues = parseTheaterSubtitles(original, track.binding.name, true)
    for (const edit of updates) {
      const { index } = edit
      if ('kind' in edit) {
        const before = edit.before.map(({ startMs, endMs, text }) => ({ startMs, endMs, text }))
        const after = edit.after.map(({ startMs, endMs, text }) => ({ startMs, endMs, text }))
        changes.push({ kind: 'timeline', language, index, before, after,
          startMs: (before[0] ?? after[0]).startMs, userId, savedAt: now })
      } else {
        const { before, text } = edit
        const cue = cues[index]
        if (!cue || cue.text !== before) throw Error('theater_subtitle_source_conflict')
        if (text !== before) changes.push({ language, index, before, text, startMs: cue.startMs, userId, savedAt: now })
      }
    }
    const output = applyChanges(original, track.binding.name, changes.slice(changeCount), language)
    if (Buffer.byteLength(output) > maxSubtitleBytes)
      throw Error('theater_subtitle_too_long')
  }
  if (changes.length === changeCount) return
  await verifyTheaterSubtitleFilm(source)
  signal.throwIfAborted()
  const result = pending
    ? await batchTable().update({ changes, version: crypto.randomUUID() }).eq('id', pending.id)
      .eq('version', pending.version).is('synced_at', null).select('id').maybeSingle()
    : await batchTable().insert({ film_id: filmId, changes }).select('id').single()
  if (result.error?.code === '23505' || !result.error && !result.data) throw Error('theater_subtitle_source_conflict')
  if (result.error) throw result.error
}

async function buildUploadPlan(source: TheaterSubtitleSource, changes: TheaterSubtitleChange[], signal: AbortSignal) {
  const plan: UploadPlan = {}
  for (const language of theaterSubtitleLanguages) {
    if (!changes.some(change => change.language === language)) continue
    const track = await readBoundTrack(source, language, signal)
    if (!track) throw Error('theater_subtitle_source_conflict')
    const output = applyChanges(track.text, track.binding.name, changes, language)
    if (Buffer.byteLength(output) > maxSubtitleBytes) throw Error('theater_subtitle_too_long')
    plan[language] = { path: track.binding.path, original: sha256(track.bytes), output }
  }
  return plan
}

async function inspectTarget(source: TheaterSubtitleSource, language: TheaterLanguage, upload: Upload, signal: AbortSignal) {
  const binding = theaterSubtitleBindings(source.film, language)
  if (!binding || binding.path !== upload.path) throw Error('theater_subtitle_source_conflict')
  const token = source.account.accessToken
  const entry = await findProjectFile(token, upload.path)
  const metadata = entry && await readBaiduFileMetadata(exactBaiduId(entry.fs_id), token)
  if (!metadata || metadata.path !== upload.path || metadata.size > maxSubtitleBytes)
    throw Error('theater_subtitle_source_conflict')
  const { id, size, md5, modifiedAt } = metadata
  const fingerprint = { size, md5, modifiedAt }
  const live = await readTheaterSubtitleBytes(source.account, source.film.directory_path, id, binding.name, fingerprint, signal)
  const checksum = sha256(live)
  const written = checksum === sha256(Buffer.from(upload.output))
  if (!written && checksum !== upload.original) throw Error('theater_subtitle_source_conflict')
  return { id, fingerprint, written }
}

export async function syncTheaterSubtitleBatch(filmId: string, signal: AbortSignal) {
  const source = await sourceRequired(filmId)
  const batch = await readPending(filmId)
  if (!batch) return
  if (batch.lease_until && Date.parse(batch.lease_until) > Date.now()) throw Error('theater_subtitle_sync_locked')

  const version = crypto.randomUUID()
  const { data: acquired, error } = await batchTable().update({
    version, lease_until: new Date(Date.now() + batchLeaseMs).toISOString(),
  }).eq('id', batch.id).eq('version', batch.version).is('synced_at', null).select('id').maybeSingle()
  if (error) throw error
  if (!acquired) throw Error('theater_subtitle_sync_locked')

  try {
    const plan = batch.upload_plan ?? await buildUploadPlan(source, batch.changes, signal)
    if (!batch.upload_plan) {
      const { error: planError } = await batchTable().update({ upload_plan: plan }).eq('id', batch.id).eq('version', version)
      if (planError) throw planError
    }
    // Check every destination before the first overwrite, then check each again at write time.
    const languages = theaterSubtitleLanguages.filter(language => plan[language])
    await Promise.all(languages.map(language => inspectTarget(source, language, plan[language]!, signal)))
    const ids: Partial<Record<TheaterLanguage, string>> = {}
    const fingerprints: Partial<Record<TheaterLanguage, BaiduFileFingerprint>> = {}
    for (const language of languages) {
      const upload = plan[language]!
      await verifyTheaterSubtitleFilm(source)
      let result = await inspectTarget(source, language, upload, signal)
      signal.throwIfAborted()
      if (!result.written) {
        await putProjectObject(source.account.accessToken, upload.path, Buffer.from(upload.output),
          { overwrite: true, verify: true })
        result = await inspectTarget(source, language, upload, signal)
      }
      if (!result.written) throw Error('theater_subtitle_sync_unverified')
      ids[language] = result.id
      fingerprints[language] = result.fingerprint
    }
    await verifyTheaterSubtitleFilm(source)
    const { data: synced, error: finishError } = await createAdminSupabase().rpc('finish_theater_subtitle_revision_batch', {
      p_film_id: filmId, p_film_revision: source.film.revision, p_batch_id: batch.id, p_batch_version: version,
      p_en_file_id: ids.en ?? null, p_zh_file_id: ids.zh ?? null, p_fingerprints: fingerprints,
    })
    if (finishError) throw finishError
    if (!synced) throw Error('theater_subtitle_source_conflict')
  } finally {
    await batchTable().update({ lease_until: null }).eq('id', batch.id).eq('version', version).is('synced_at', null)
  }
}

export async function clearTheaterSubtitleHistory(filmId: string, batchId: string) {
  await sourceRequired(filmId)
  const { error } = await batchTable().delete().eq('id', batchId).eq('film_id', filmId).not('synced_at', 'is', null)
  if (error) throw error
}
