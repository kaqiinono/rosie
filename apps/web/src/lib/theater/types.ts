export const theaterSubtitleLanguages = ['en', 'zh'] as const
export type TheaterLanguage = (typeof theaterSubtitleLanguages)[number]
export const theaterLanguageLabel = { en: '英文', zh: '中文' } satisfies Record<TheaterLanguage, string>

export const theaterVideoExtension = /\.(mp4|mkv|rmvb)$/i
export type TheaterVideoFormat = 'mp4' | 'mkv' | 'rmvb'
export const theaterVideoMime = { mp4: 'video/mp4', mkv: 'video/x-matroska', rmvb: 'application/vnd.rn-realmedia-vbr' }
export function theaterVideoFormat(name: string): TheaterVideoFormat | undefined {
  return theaterVideoExtension.exec(name)?.[1].toLowerCase() as TheaterVideoFormat | undefined
}
export const theaterVideoStem = (name: string) => name.replace(theaterVideoExtension, '')
export const theaterPlaybackCopyName = (name: string) => theaterVideoStem(name) + '.playback.mp4'
export const theaterAudioExtension = /\.(mp3|m4a|aac)$/i
export const theaterProbedAudioCodecs = new Set(['ac-3', 'ec-3', 'dtsc', 'dtse', 'dtsh', 'dtsl'])
const theaterAudioTypes = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac' } as const

export function theaterAudioMime(name: string) {
  const extension = theaterAudioExtension.exec(name)?.[1].toLowerCase() as keyof typeof theaterAudioTypes | undefined
  return extension ? theaterAudioTypes[extension] : undefined
}

export function matchTheaterAudio(videoName: string, files: TheaterDirectoryFile[]) {
  const normalize = (name: string) => name.normalize('NFKC').toLowerCase().trim()
  const stem = normalize(theaterVideoStem(videoName))
  const matches = files.filter(file => theaterAudioExtension.test(file.name) &&
    normalize(file.name.replace(theaterAudioExtension, '')) === stem)
  return matches.length === 1 ? matches[0].fileId : ''
}

export function theaterInternalAudioUnavailable(codecs: string[] | null, audioTrackCount: number | undefined,
  canPlayType: (type: string) => string) {
  if (audioTrackCount === 0) return true
  // Unknown metadata leaves playback in automatic mode with the internal track selected.
  return codecs?.every(codec => theaterProbedAudioCodecs.has(codec) &&
    !canPlayType(`audio/mp4; codecs="${codec}"`) &&
    !canPlayType(`audio/x-matroska; codecs="${codec}"`)) ?? false
}

export interface TheaterFilm {
  id: string
  title: string
  languages: TheaterLanguage[]
  format: TheaterVideoFormat
  hasPlaybackCopy: boolean
  hasExternalAudio: boolean
}

export interface TheaterPlaybackFilm extends TheaterFilm {
  videoAudioCodecs: string[] | null
  playbackAudioCodecs: string[] | null
}

export interface TheaterAdminFilm extends TheaterFilm {
  published: boolean
  revision: string
  directoryId: string | null
  videoName: string
  playbackName: string | null
  externalAudioName: string | null
}

export interface TheaterDirectoryFile {
  fileId: string
  name: string
  folder: string
}

export interface TheaterDirectoryInventory {
  videos: TheaterDirectoryFile[]
  subtitles: TheaterDirectoryFile[]
  audio: TheaterDirectoryFile[]
}

export interface TheaterAudioSelection {
  files: TheaterDirectoryFile[]
  selectedId: string | null
  revision: string
}

export interface TheaterMediaDirectory {
  directoryId: string
  path: string
  revision: string
}

export interface TheaterMediaDirectorySettings {
  directory: TheaterMediaDirectory | null
}

export interface SubtitleCue {
  startMs: number
  endMs: number
  text: string
}

export interface TheaterCue {
  id: string
  startMs: number
  endMs: number
  en?: string
  zh?: string
  sourceCues?: Partial<Record<TheaterLanguage, number[]>>
}

export type SubtitleTracks = Partial<Record<TheaterLanguage, SubtitleCue[]>>

export type TheaterCueAction = 'edit' | 'split' | 'previous' | 'next' | 'remove'
export type TheaterCueShortcut = Exclude<TheaterCueAction, 'edit'>
export type TheaterSubtitleSelection = TheaterCue | 'insert'

export interface TheaterSubtitleEdit {
  language: TheaterLanguage
  index: number
  before: string
  text: string
}

export interface TheaterSubtitleSplice {
  kind: 'timeline'
  language: TheaterLanguage
  index: number
  before: SubtitleCue[]
  after: SubtitleCue[]
}

export type TheaterSubtitleChange = (TheaterSubtitleEdit | TheaterSubtitleSplice) & {
  startMs: number
  userId: string
  savedAt: string
}

export interface TheaterSubtitleRevisionBatch {
  id: string
  changes: TheaterSubtitleChange[]
  synced_at: string | null
}

export interface TheaterSubtitleRevisionStatus {
  pending: TheaterSubtitleRevisionBatch | null
  syncStarted: boolean
  history: TheaterSubtitleRevisionBatch[]
  hasMore: boolean
}

export interface TheaterSubtitles {
  tracks: SubtitleTracks
  canEdit: boolean
  editor?: {
    version: string
    precision: Partial<Record<TheaterLanguage, number>>
  }
}

export interface MatchedTheaterSubtitle {
  language: TheaterLanguage | null
  fileId: string
  name: string
  cueCount: number
  preview: string
}

export type TheaterSubtitleJobState = 'queued' | 'transcribing' | 'writing' | 'ready' | 'failed' | 'submission_unknown'

export interface TheaterSubtitleJob {
  id: string
  state: TheaterSubtitleJobState
  subtitle: MatchedTheaterSubtitle | null
  message: string | null
}

export interface TheaterSubtitleMatchResult {
  tracks: MatchedTheaterSubtitle[]
  suggested: Partial<Record<TheaterLanguage, string>>
  failedCount: number
  remainingCount: number
  job?: TheaterSubtitleJob
  jobError?: string
}

export interface TheaterStudyItem {
  kind: 'favorite' | 'note' | 'word'
  item_key: string
  position_ms: number
  cue_text: string
  detail: string
  headword_id: string | null
}

export const validTheaterId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
