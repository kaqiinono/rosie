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
  const knightAtDawn = findStoryVolume(series, 'the-knight-at-dawn')!

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

  it('registers The Knight at Dawn as volume 2 with ten ordered chapters', () => {
    expect(knightAtDawn.number).toBe(2)
    expect(knightAtDawn.chapters).toHaveLength(10)
    expect(knightAtDawn.chapters.map((chapter) => chapter.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(knightAtDawn.chapters.map((chapter) => chapter.title)).toEqual([
      'The Dark Woods',
      'Leaving Again',
      'Across the Bridge',
      'Into the Castle',
      'Trapped',
      'Ta-da!',
      'A Secret Passage',
      'The Knight',
      'Under the Moon',
      'One Mystery Solved',
    ])
  })

  it('keeps volume 2 story body complete and excludes front matter and previews', () => {
    const body = knightAtDawn.chapters.flatMap((chapter) => chapter.paragraphs).join('\n')
    expect(body).toContain('Jack couldn’t sleep.')
    expect(body).toContain('Into the mist.')
    expect(body).toContain('heavy head')
    expect(body).toContain('hawks in hawk house')
    expect(body).toContain('they eat peacocks?')
    expect(body).not.toMatch(
      /Text copyright|Library of Congress|Special Preview|Mummies in the Morning/i,
    )
  })

  it('keeps stable anchors and chapter-scoped recording keys for volume 2', () => {
    const chapter = findStoryChapter(knightAtDawn, 'ch10')!
    const sentences = splitStorySentences(chapter).flat()
    expect(sentences[0]).toMatchObject({ id: 'ch10-s001', index: 1 })
    expect(new Set(sentences.map((sentence) => sentence.id)).size).toBe(sentences.length)
    expect(storyContentKey(knightAtDawn, chapter)).toBe('the-knight-at-dawn:ch10')
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
