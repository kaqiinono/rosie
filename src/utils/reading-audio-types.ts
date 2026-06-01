/** Supabase Storage bucket for reading passage narration. */
export const READING_AUDIO_BUCKET = 'reading'

/** Storage object path, e.g. `passages/u5l2/narration.mp3`. */
export function readingPassageAudioPath(passageKey: string): string {
  return `passages/${passageKey}/narration.mp3`
}

export type ReadingPassageMediaRow = {
  passageKey: string
  audioPath: string
  updatedAt: string
}

const AUDIO_EXT_RE = /\.(mp3|m4a|wav|aac|ogg|webm|flac)$/i

export function isReadingAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return AUDIO_EXT_RE.test(file.name)
}

export function readingAudioContentType(file: File): string {
  if (file.type) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.aac')) return 'audio/aac'
  return 'audio/mpeg'
}
