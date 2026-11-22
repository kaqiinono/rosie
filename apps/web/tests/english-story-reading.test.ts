import { describe, expect, it } from 'vitest'
import { storyNarrationTracks } from '../../../packages/english/src/utils/story-narration-tracks'
import {
  findStoryChapter,
  findStorySeries,
  findStoryVolume,
  splitStorySentences,
  storyContentKey,
  storyRecordingStoragePath,
  storySeries,
  storyShelfEntries,
  warriorsCollection,
} from '../../../packages/english/src'

const warriorsCatalog = [
  ['the-prophecies-begin', ['into-the-wild', 'fire-and-ice', 'forest-of-secrets', 'rising-storm', 'a-dangerous-path', 'the-darkest-hour'], [25, 30, 30, 30, 27, 30]],
  ['the-new-prophecy', ['midnight', 'moonrise', 'dawn', 'starlight', 'twilight', 'sunset'], [24, 24, 25, 23, 24, 23]],
  ['power-of-three', ['the-sight', 'dark-river', 'outcast', 'eclipse', 'long-shadows', 'sunrise'], [25, 21, 29, 25, 28, 28]],
  ['omen-of-the-stars', ['the-fourth-apprentice', 'fading-echoes', 'night-whispers', 'sign-of-the-moon', 'the-forgotten-warrior', 'the-last-hope'], [26, 24, 25, 22, 25, 27]],
  ['dawn-of-the-clans', ['the-sun-trail', 'thunder-rising', 'the-first-battle', 'the-blazing-star', 'a-forest-divided', 'path-of-stars'], [26, 27, 23, 28, 25, 24]],
  ['a-vision-of-shadows', ['the-apprentices-quest', 'thunder-and-shadow', 'shattered-sky', 'darkest-night', 'river-of-fire', 'the-raging-storm'], [24, 24, 22, 23, 21, 25]],
  ['the-broken-code', ['lost-stars', 'the-silent-thaw', 'veil-of-shadows', 'darkness-within', 'the-place-of-no-stars', 'a-light-in-the-mist'], [24, 24, 23, 25, 23, 24]],
  ['a-starless-clan', ['river', 'sky', 'shadow', 'thunder', 'wind', 'star'], [23, 22, 24, 22, 23, 23]],
] as const

describe('Warriors story catalog', () => {
  it('shows one shelf card for Warriors and lists the eight seasons inside it', () => {
    expect(storyShelfEntries.filter(({ slug }) => slug === 'warriors' || slug.startsWith('warriors-'))).toEqual([
      expect.objectContaining({ slug: 'warriors', language: 'en', count: 8, unit: '季' }),
    ])
    expect(warriorsCollection.seasons.map(({ seasonNumber, slug }) => [seasonNumber, slug])).toEqual(
      warriorsCatalog.map(([slug], index) => [index + 1, `warriors-${slug}`]),
    )
  })

  for (const [season, slugs, chapterCounts] of warriorsCatalog) {
    it(`registers six complete volumes for ${season}`, () => {
      const series = findStorySeries(storySeries, `warriors-${season}`)!
      expect(series.author).toBe('Erin Hunter')
      expect(series.volumes.map(({ slug }) => slug)).toEqual(slugs)
      expect(series.volumes.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6])
      series.volumes.forEach((volume, index) => {
        const numberedChapters = Array.from({ length: chapterCounts[index]! }, (_, chapterIndex) =>
          `ch${String(chapterIndex + 1).padStart(2, '0')}`,
        )
        const epilogue = ['midnight', 'moonrise'].includes(volume.slug) ? ['epilogue'] : []
        expect(volume.chapters.map(({ key }) => key)).toEqual(['prologue', ...numberedChapters, ...epilogue])
        expect(volume.chapters.every(({ paragraphs }) => paragraphs.length > 0)).toBe(true)
        const tracks = storyNarrationTracks(volume, volume.chapters)
        expect(volume.originalAudioFiles?.length).toBeGreaterThan(0)
        expect(tracks.map(track => track.filename)).toEqual(volume.originalAudioFiles)
        expect(new Set(tracks.map(track => track.slot)).size).toBe(tracks.length)
      })
    })
  }

  it('keeps the original chapters distinct from a second whole-book recording', () => {
    const series = findStorySeries(storySeries, 'warriors-the-broken-code')!
    const volume = findStoryVolume(series, 'darkness-within')!
    const tracks = storyNarrationTracks(volume, volume.chapters)
    expect(tracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ filename: 'darkness-within.mp3', slot: 'narration', file: 'full' }),
      expect.objectContaining({ filename: 'chapter-01.mp3', slot: 'chapter:ch01', file: 'ch01' }),
    ]))
    expect(tracks.some(track => track.slot.startsWith('track:part-'))).toBe(false)
  })

  it('addresses the eight Sun Trail MP3s on their own timelines', () => {
    const series = findStorySeries(storySeries, 'warriors-dawn-of-the-clans')!
    const volume = findStoryVolume(series, 'the-sun-trail')!
    const tracks = storyNarrationTracks(volume, volume.chapters)
    const files = Array.from({ length: 8 }, (_, index) => `part-${String(index + 1).padStart(2, '0')}`)
    expect(tracks.map(track => track.file)).toEqual(files)
    expect(tracks.map(track => track.slot)).toEqual(files.map(file => `track:${file}`))
  })
})

describe('Warriors: The Prophecies Begin story catalog', () => {
  const series = findStorySeries(storySeries, 'warriors-the-prophecies-begin')!
  const volume = findStoryVolume(series, 'into-the-wild')!

  it('retains the prologue and all 25 published chapters in order', () => {
    expect(series.author).toBe('Erin Hunter')
    expect(volume.number).toBe(1)
    expect(volume.chapters.map(({ key, number, title }) => ({ key, number, title }))).toEqual([
      { key: 'prologue', number: 0, title: 'Prologue' },
      ...Array.from({ length: 25 }, (_, index) => ({
        key: `ch${String(index + 1).padStart(2, '0')}`,
        number: index + 1,
        title: `Chapter ${index + 1}`,
      })),
    ])
  })

  it('preserves story bounds and stable narration and recording anchors', () => {
    const prologue = findStoryChapter(volume, 'prologue')!
    const firstChapter = findStoryChapter(volume, 'ch01')!
    const lastChapter = findStoryChapter(volume, 'ch25')!
    expect(splitStorySentences(prologue)[0][0]).toMatchObject({
      id: 'prologue-s001',
      text: 'A half-moon glowed on smooth granite boulders, turning them silver.',
    })
    expect(splitStorySentences(firstChapter)[0][0]).toMatchObject({ id: 'ch01-s001', text: 'It was very dark.' })
    expect(storyContentKey(volume, prologue)).toBe('into-the-wild:prologue')
    expect(lastChapter.paragraphs.at(-1)).toMatch(/Fireheart was ready for the challenge\.$/)

    const paragraphs = volume.chapters.flatMap((chapter) => chapter.paragraphs)
    expect(paragraphs).not.toContain('ALLEGIANCES')
    expect(paragraphs.join('\n')).not.toMatch(/About the Author|Text copyright|All rights reserved|About the Publisher/i)
  })
})

describe('Dragon Masters story catalog', () => {
  const series = findStorySeries(storySeries, 'dragon-masters')!
  const volume = findStoryVolume(series, 'rise-of-the-earth-dragon')!

  it('registers the full first volume with stable chapter keys and transcribed letters', () => {
    expect(series.author).toBe('Tracey West')
    expect(volume.number).toBe(1)
    expect(volume.chapters.map((chapter) => chapter.key)).toEqual(
      Array.from({ length: 16 }, (_, index) => `ch${String(index + 1).padStart(2, '0')}`),
    )
    expect(volume.chapters[0].title).toBe('To the Castle!')
    expect(splitStorySentences(volume.chapters[0])[0][0]).toMatchObject({
      id: 'ch01-s001',
      text: 'Drake didn’t see the king’s soldier coming.',
    })
    expect(findStoryChapter(volume, 'ch06')!.paragraphs).toContain('Dear Mother,')
    expect(findStoryChapter(volume, 'ch09')!.paragraphs).toContain('Dear Drake,')
    expect(volume.chapters.at(-1)?.title).toBe('Just the Beginning')
    expect(volume.chapters.at(-1)?.paragraphs.at(-1)).toBe('He was a Dragon Master.')
  })

  it('anchors every illustration to the correct chapter and includes a glossary in every chapter', () => {
    const paths = new Set<string>()
    for (const chapter of volume.chapters) {
      expect(chapter.glossary.length).toBeGreaterThan(0)
      expect(chapter.glossary.every((entry) => entry.ipa && entry.meaningCn && entry.meaningEn)).toBe(true)
      expect(chapter.illustrations?.[0]?.afterParagraph).toBe(-1)
      let previousIndex = -1
      for (const illustration of chapter.illustrations ?? []) {
        expect(illustration.path).toContain(`stories/${series.slug}/${volume.slug}/${chapter.key}-p`)
        expect(illustration.afterParagraph).toBeGreaterThanOrEqual(previousIndex)
        expect(illustration.afterParagraph).toBeLessThan(chapter.paragraphs.length)
        previousIndex = illustration.afterParagraph
        paths.add(illustration.path)
      }
    }
    expect(paths.size).toBe(85)
  })

  it('registers Saving the Sun Dragon as the second illustrated volume', () => {
    const sequel = findStoryVolume(series, 'saving-the-sun-dragon')!
    expect(series.volumes.slice(0, 2).map(({ number }) => number)).toEqual([1, 2])
    expect(sequel.number).toBe(2)
    expect(sequel.chapters.map(({ key }) => key)).toEqual(
      Array.from({ length: 14 }, (_, index) => `ch${String(index + 1).padStart(2, '0')}`),
    )
    expect(findStoryChapter(sequel, 'ch01')?.title).toBe('Dragons in the Sky')
    expect(findStoryChapter(sequel, 'ch05')?.paragraphs).toContain('Dear Drake,')
    expect(sequel.chapters.at(-1)?.title).toBe('Home')
    expect(sequel.chapters.every(({ glossary }) => glossary.length > 0)).toBe(true)
    const paths = new Set(sequel.chapters.flatMap(({ illustrations }) => illustrations?.map(({ path }) => path) ?? []))
    expect(paths.size).toBe(78)
    expect([...paths].every((path) => path.startsWith(`stories/${series.slug}/${sequel.slug}/`))).toBe(true)
  })

  it.each([
    ['call-of-the-sound-dragon', 'ch07', 'ch07-s012', '“Quack! Quack! Quack quack quack quack!”', 'Griffith scolded.'],
    ['curse-of-the-shadow-dragon', 'ch06', 'ch06-s019', 'She would always say, ‘Chaya follows me around just like a shadow.’”', '“That is very sweet,” Drake remarked.'],
  ])('preserves the reviewed narration boundary in %s / %s', (slug, key, id, text, nextText) => {
    const book = findStoryVolume(series, slug)!
    const sentences = splitStorySentences(findStoryChapter(book, key)!).flat()
    const index = sentences.findIndex((sentence) => sentence.id === id)
    expect(sentences.slice(index, index + 2).map((sentence) => sentence.text)).toEqual([text, nextText])
  })

  it('keeps all numbered books in order and lists the guide separately', () => {
    const books = series.volumes.filter((entry) => entry.kind !== 'guide')
    const guide = findStoryVolume(series, 'griffiths-guide-for-dragon-masters')!
    expect(books.map(({ number }) => number)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1))
    expect(books.slice(2).reduce((total, entry) => total + entry.chapters.length, 0)).toBe(325)
    expect(guide.kind).toBe('guide')
    expect(guide.chapters).toHaveLength(20)
    const seaDragon = findStoryVolume(series, 'wave-of-the-sea-dragon')!
    expect(findStoryChapter(seaDragon, 'ch06')?.title).toBe('Enemies, Not Friends')
    const invisibleDragons = findStoryVolume(series, 'guarding-the-invisible-dragons')!
    expect(findStoryChapter(invisibleDragons, 'ch15')?.paragraphs[0]).toContain('The light from the Dragon Stone')
  })
})

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
