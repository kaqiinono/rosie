import { describe, expect, it } from 'vitest'
import {
  findStoryChapter,
  findStorySeries,
  findStoryVolume,
  splitStorySentences,
  storyContentKey,
  storyRecordingStoragePath,
  storySeries,
} from '../../../packages/english/src'

describe('Magic Tree House story catalog', () => {
  const series = findStorySeries(storySeries, 'magic-tree-house')!
  const volume = findStoryVolume(series, 'dinosaurs-before-dark')!

  it('registers Dinosaurs Before Dark as volume 1 with ten ordered chapters', () => {
    expect(series.title).toBe('Magic Tree House')
    expect(volume.number).toBe(1)
    expect(volume.chapters).toHaveLength(10)
    expect(volume.chapters.map((chapter) => chapter.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(volume.chapters[0]?.title).toBe('Into the Woods')
    expect(volume.chapters.at(-1)?.title).toBe('Home Before Dark')
  })

  it('keeps stable chapter and sentence anchors', () => {
    const chapter = findStoryChapter(volume, 'ch01')!
    const sentences = splitStorySentences(chapter).flat()
    expect(sentences[0]).toMatchObject({ id: 'ch01-s001', index: 1 })
    expect(new Set(sentences.map((sentence) => sentence.id)).size).toBe(sentences.length)
  })

  it('contains story body only', () => {
    const body = volume.chapters.flatMap((chapter) => chapter.paragraphs).join('\n')
    expect(body).not.toMatch(/Table of Contents|Text copyright|MagicTreeHouse\.com/i)
    expect(body).not.toMatch(/\bm filled\b|\bcoining toward\b/i)
  })

  it('builds stable recording keys and owner-scoped paths', () => {
    const chapter = volume.chapters[0]!
    expect(storyContentKey(volume, chapter)).toBe('dinosaurs-before-dark:ch01')
    expect(
      storyRecordingStoragePath({
        userId: 'user-1',
        scope: 'chapter',
        contentKey: storyContentKey(volume, chapter),
        recordingId: 'clip-1',
        extension: 'mp3',
      }),
    ).toBe('user-1/chapter/dinosaurs-before-dark/ch01/clip-1.mp3')
  })
})
