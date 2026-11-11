/** Supabase Storage bucket for reading passage narration. */
export const READING_AUDIO_BUCKET = 'reading'

/** Storage object path, e.g. `passages/u5l2/narration.mp3`. */
export function readingPassageAudioPath(passageKey: string): string {
  return `passages/${passageKey}/narration.mp3`
}

/** Same-origin authenticated stream; Baidu credentials never enter the URL. */
export function baiduReadingAudioUrl(passageKey: string): string {
  return `/api/baidu/audio/${encodeURIComponent(passageKey)}`
}

export type ReadingPassageMediaRow = {
  passageKey: string
  audioPath: string
  updatedAt: string
}

const AUDIO_EXT_RE = /\.(mp3|m4a|wav|aac|ogg|webm|flac)$/i

export function lessonAudioMime(path: string): string | undefined {
  const types: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    flac: 'audio/flac',
  }
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return Object.hasOwn(types, extension) ? types[extension] : undefined
}

export function isReadingAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return AUDIO_EXT_RE.test(file.name)
}

export function lessonAudioUrl(key: string, slot: string) {
  return baiduReadingAudioUrl(key) + '?asset=' + encodeURIComponent(slot)
}
