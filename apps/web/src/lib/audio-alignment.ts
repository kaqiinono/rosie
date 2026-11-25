import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { listeningClipsFor, readingSegments } from '@rosie/english/utils/listening-clips'
import { findPassageByKey, readingPassages } from '@rosie/english/utils/reading-data'
import { storySeries } from '@rosie/english/utils/story-data'
import { storyNarrationTracks } from '@rosie/english/utils/story-narration-tracks'
import { readStoryCues } from '@rosie/english/utils/story-timing'
import { findStorySeries, findStoryVolume, splitStorySentences } from '@rosie/english/utils/story-types'
import type { AlignmentChoice, AlignmentTarget, AlignmentTrack, AudioMark, AudioMarks } from './audio-alignment-contract'
import { createAdminSupabase } from './api-auth'

type Track = AlignmentTrack & {
  targets: AlignmentTarget[]
  canSkip: boolean
  legacyPath?: string
  expectedFilename?: string
  initial?: AudioMarks
}
type Binding = { slot: string; file_id: string; path: string }
type StoredTrack = { slot: string; source_signature: string; marks: AudioMarks }
type BoundTrack = Binding & { source_signature: string | null; marks: AudioMarks | null }

async function readTimingAsset(path: string) {
  try {
    return await readFile(join(process.cwd(), 'public', path), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function storyTracks(key: string): Promise<Track[]> {
  const [prefix, seriesSlug, volumeSlug, ...rest] = key.split(':')
  if (prefix !== 'story' || !seriesSlug || !volumeSlug || rest.length) return []
  const series = findStorySeries(storySeries, seriesSlug)
  const volume = series?.language === 'en' ? findStoryVolume(series, volumeSlug) : undefined
  if (!volume) return []
  const base = `story-timings/${seriesSlug}/${volumeSlug}`
  const tracks = storyNarrationTracks(volume, volume.chapters)
    .filter(track => track.file !== 'title' && track.file !== 'credits')
  const indexText = tracks.some(track => track.file.startsWith('part-')) ? await readTimingAsset(base + '/track-index.json') : null
  const index: { chapters?: Record<string, { file: string }[]> } | null = indexText ? JSON.parse(indexText) : null
  return tracks.map(track => {
    const mapped = volume.chapters.filter(chapter => index?.chapters?.[chapter.key]?.some(range => range.file === track.file))
    const chapters = track.slot.startsWith('chapter:')
      ? volume.chapters.filter(chapter => chapter.key === track.file)
      : mapped.length ? mapped : volume.chapters
    return {
      slot: track.slot,
      label: track.label,
      expectedFilename: track.filename,
      canSkip: true,
      legacyPath: `${base}/${track.file}.vtt`,
      targets: chapters.flatMap(chapter => splitStorySentences(chapter).flat().map(({ id, text }) =>
        ({ id, text, group: chapter.title }),
      )),
    }
  })
}

function textbookTracks(key: string): Track[] {
  const passage = findPassageByKey(key)
  if (!passage) return []
  const initial: AudioMarks = {}
  const targets = passage.paragraphs.flatMap((_, paragraph) =>
    readingSegments(passage, paragraph).map((text, sentence) => {
      const id = `${paragraph}-${sentence}`
      const range = passage.narrationCues?.[paragraph]?.[sentence]
      if (range && range[0] < range[1]) {
        initial[id] = { status: 'timed', startMs: Math.round(range[0] * 1000), endMs: Math.round(range[1] * 1000) }
      }
      return { id, text, group: `第 ${paragraph + 1} 段` }
    }),
  )
  return [
    { slot: 'narration', label: '整课朗读', canSkip: true, initial, targets },
    ...listeningClipsFor(passage).map(clip => ({
      slot: 'clip:' + clip.target,
      label: '听记 · ' + clip.english,
      canSkip: false,
      targets: [{ id: clip.target, text: clip.english, group: '听记' }],
    })),
  ]
}

const adapters: {
  id: string
  label: string
  choices: () => Pick<AlignmentChoice, 'key' | 'label'>[]
  tracks: (key: string) => Track[] | Promise<Track[]>
}[] = [
  {
    id: 'story',
    label: '故事',
    choices: () => storySeries.filter(series => series.language === 'en').flatMap(series =>
      series.volumes.map(volume => ({
        key: `story:${series.slug}:${volume.slug}`,
        label: `${series.title} · ${volume.title}`,
      })),
    ),
    tracks: storyTracks,
  },
  {
    id: 'reading',
    label: '教材阅读',
    choices: () => readingPassages.map(passage => ({
      key: passage.key,
      label: `${passage.stage} ${passage.unit} ${passage.lesson} · ${passage.title}`,
    })),
    tracks: textbookTracks,
  },
]

export function alignmentChoices(): AlignmentChoice[] {
  return adapters.flatMap(adapter => adapter.choices().map(choice =>
    ({ ...choice, module: adapter.id, moduleLabel: adapter.label }),
  ))
}

export async function alignmentTracks(key: string): Promise<Track[]> {
  for (const adapter of adapters) {
    const tracks = await adapter.tracks(key)
    if (tracks.length) return tracks
  }
  return []
}

export async function boundAlignment(key: string) {
  const db = createAdminSupabase()
  const credentials = await db.from('baidu_oauth_credentials').select('account_id').eq('id', 'primary').maybeSingle()
  if (credentials.error) throw credentials.error
  const accountId = credentials.data?.account_id as string | undefined
  if (!accountId) return { db, accountId, bindings: [] as Binding[] }
  const { data, error } = await db.from('english_audio_bindings').select('slot,file_id,path')
    .eq('account_id', accountId).eq('lesson_key', key)
  if (error) throw error
  return { db, accountId, bindings: data as Binding[] }
}

export async function storedAlignment(key: string, bound: Awaited<ReturnType<typeof boundAlignment>>) {
  if (!bound.accountId || !bound.bindings.length) return [] as StoredTrack[]
  const { data, error } = await bound.db.from('audio_alignments').select('slot,source_signature,marks')
    .eq('account_id', bound.accountId).eq('content_key', key)
  if (error) throw error
  return data as StoredTrack[]
}

export async function readBoundAlignments(key: string, slot: string | null) {
  const { data, error } = await createAdminSupabase().rpc('read_english_audio_alignments', {
    p_lesson_key: key, p_slot: slot,
  })
  if (error) throw error
  return data as BoundTrack[]
}

export function alignmentSignature(track: Track, binding: Binding) {
  return createHash('sha256').update(JSON.stringify([
    binding.file_id, binding.path, track.targets.map(({ id, text }) => [id, text]),
  ])).digest('hex')
}

export async function initialAlignment(track: Track, binding: Binding) {
  if (!track.legacyPath) return track.initial ?? {}
  if (track.expectedFilename && !binding.path.endsWith('/' + track.expectedFilename)) return {}
  const raw = await readTimingAsset(track.legacyPath)
  if (!raw) return {}
  const legacy = readStoryCues(raw)
  return Object.fromEntries(track.targets.flatMap(({ id }) => {
    const cue = legacy.get(id)
    return cue ? [[id, { status: 'timed', ...cue }]] : []
  })) as AudioMarks
}

export async function alignmentCandidates(track: Track, binding: Binding): Promise<AlignmentTarget[]> {
  if (!track.legacyPath || (track.expectedFilename && !binding.path.endsWith('/' + track.expectedFilename))) return track.targets
  const raw = await readTimingAsset(track.legacyPath.replace(/\.vtt$/, '.candidates.json'))
  if (!raw) return track.targets
  const candidates: Record<string, number> = JSON.parse(raw)
  return track.targets.map(target => {
    const candidateMs = candidates[target.id]
    return Number.isSafeInteger(candidateMs) && candidateMs >= 0 ? { ...target, candidateMs } : target
  })
}

export function parseAudioMark(value: unknown): AudioMark | null {
  if (!value || typeof value !== 'object') return null
  if ('status' in value && value.status === 'skipped') return { status: 'skipped' }
  if ('status' in value && value.status === 'timed' && 'startMs' in value && 'endMs' in value &&
      typeof value.startMs === 'number' && typeof value.endMs === 'number' &&
      Number.isSafeInteger(value.startMs) && Number.isSafeInteger(value.endMs) &&
      value.startMs >= 0 && value.endMs > value.startMs && value.endMs <= 86_400_000) {
    return { status: 'timed', startMs: value.startMs, endMs: value.endMs }
  }
  return null
}
