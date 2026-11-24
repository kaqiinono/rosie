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

export interface TheaterFilm {
  id: string
  title: string
  languages: TheaterLanguage[]
  format: TheaterVideoFormat
  hasPlaybackCopy: boolean
}

export interface TheaterAdminFilm extends TheaterFilm {
  published: boolean
  revision: string
  directoryId: string | null
  videoName: string
  playbackName: string | null
}

export interface TheaterDirectoryFile {
  fileId: string
  name: string
  folder: string
}

export interface TheaterDirectoryInventory {
  videos: TheaterDirectoryFile[]
  subtitles: TheaterDirectoryFile[]
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

export interface TheaterSubtitleEdit {
  language: TheaterLanguage
  index: number
  before: string
  text: string
}

export interface TheaterSubtitleChange extends TheaterSubtitleEdit {
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
