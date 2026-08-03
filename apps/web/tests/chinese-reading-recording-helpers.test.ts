import { describe, expect, it } from 'vitest'
import {
  CHINESE_READING_RECORDINGS_BUCKET,
  buildRecordingStoragePath,
  extForMime,
  parseRecordingRows,
} from '@rosie/chinese'

describe('extForMime', () => {
  it('maps webm/mp4/m4a and defaults to webm', () => {
    expect(extForMime('audio/webm')).toBe('webm')
    expect(extForMime('audio/webm;codecs=opus')).toBe('webm')
    expect(extForMime('audio/mp4')).toBe('mp4')
    expect(extForMime('audio/m4a')).toBe('m4a')
    expect(extForMime('audio/unknown')).toBe('webm')
  })
})

describe('buildRecordingStoragePath', () => {
  it('builds user/book/lesson/timestamp.ext', () => {
    const path = buildRecordingStoragePath({
      userId: 'user-1',
      bookSlug: 'g1b',
      lessonKey: 'u1-l1',
      mimeType: 'audio/webm',
      timestampMs: 1700000000000,
    })
    expect(path).toBe('user-1/g1b/u1-l1/1700000000000.webm')
    expect(CHINESE_READING_RECORDINGS_BUCKET).toBe('chinese-reading-recordings')
  })
})

describe('parseRecordingRows', () => {
  it('maps snake_case rows', () => {
    const rows = parseRecordingRows([
      {
        id: 'r1',
        book_slug: 'g1b',
        lesson_key: 'u1-l1',
        lesson_title: '春夏秋冬',
        storage_path: 'user-1/g1b/u1-l1/1.webm',
        mime_type: 'audio/webm',
        duration_ms: 1200,
        created_at: '2026-08-03T00:00:00.000Z',
      },
    ])
    expect(rows[0]).toEqual({
      id: 'r1',
      bookSlug: 'g1b',
      lessonKey: 'u1-l1',
      lessonTitle: '春夏秋冬',
      storagePath: 'user-1/g1b/u1-l1/1.webm',
      mimeType: 'audio/webm',
      durationMs: 1200,
      createdAt: '2026-08-03T00:00:00.000Z',
    })
  })
})
