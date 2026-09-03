export const STORY_RECORDINGS_BUCKET = 'english-story-recordings'

export type StoryRecordingScope = 'chapter'

export interface StoryRecording {
  id: string
  contentKey: string
  scope: StoryRecordingScope
  title: string
  storagePath: string
  mimeType: string
  durationMs: number | null
  updatedAt: string
}

export interface RawStoryRecordingRow {
  id: string
  content_key: string
  scope: StoryRecordingScope
  title: string
  storage_path: string
  mime_type: string
  duration_ms: number | null
  updated_at: string
}

export function storyRecordingStoragePath(args: {
  userId: string
  scope: StoryRecordingScope
  contentKey: string
  recordingId: string
  extension: string
}): string {
  const safeKey = args.contentKey.replace(/[^a-z0-9:_-]+/gi, '-').replace(/:/g, '/')
  return `${args.userId}/${args.scope}/${safeKey}/${args.recordingId}.${args.extension}`
}

export function mapStoryRecording(row: RawStoryRecordingRow): StoryRecording {
  return {
    id: row.id,
    contentKey: row.content_key,
    scope: row.scope,
    title: row.title,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationMs: row.duration_ms,
    updatedAt: row.updated_at,
  }
}
