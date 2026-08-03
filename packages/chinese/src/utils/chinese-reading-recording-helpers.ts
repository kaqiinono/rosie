export const CHINESE_READING_RECORDINGS_BUCKET = 'chinese-reading-recordings'

export type ChineseReadingRecording = {
  id: string
  bookSlug: string
  lessonKey: string
  lessonTitle: string
  storagePath: string
  mimeType: string
  durationMs: number | null
  createdAt: string
}

export type RawRecordingRow = {
  id: string
  book_slug: string
  lesson_key: string
  lesson_title: string
  storage_path: string
  mime_type: string
  duration_ms: number | null
  created_at: string
}

export function extForMime(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (base === 'audio/mp4' || base === 'video/mp4') return 'mp4'
  if (base === 'audio/m4a' || base === 'audio/x-m4a') return 'm4a'
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3'
  if (base.includes('webm')) return 'webm'
  return 'webm'
}

export function buildRecordingStoragePath(args: {
  userId: string
  bookSlug: string
  lessonKey: string
  mimeType: string
  timestampMs?: number
}): string {
  const ts = args.timestampMs ?? Date.now()
  const ext = extForMime(args.mimeType)
  // lessonKey may contain chars unsafe for paths — keep as-is if keys are already safe (u1-l1);
  // replace path separators only:
  const lesson = args.lessonKey.replace(/[\\/]/g, '_')
  return `${args.userId}/${args.bookSlug}/${lesson}/${ts}.${ext}`
}

export function parseRecordingRows(data: RawRecordingRow[]): ChineseReadingRecording[] {
  return data.map((r) => ({
    id: r.id,
    bookSlug: r.book_slug,
    lessonKey: r.lesson_key,
    lessonTitle: r.lesson_title,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }))
}
