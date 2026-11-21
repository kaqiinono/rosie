import type { GlossaryWord } from './reading-data'

export interface StoryIllustration {
  /** Zero-based paragraph index, or -1 for an illustration before the chapter heading. */
  afterParagraph: number
  /** Object key in the project reading directory. */
  path: string
  alt: string
  width: number
  height: number
  /** Also shown in a standalone chapter when the spread is already placed in the preceding chapter. */
  chapterOnly?: true
}

export interface StoryChapter {
  key: string
  number: number
  title: string
  paragraphs: string[]
  /** Verbatim spans that form one narration cue despite internal sentence punctuation. */
  unbrokenSentences?: string[]
  glossary: GlossaryWord[]
  /** Offsets in the original whole-book recording, measured from its beginning. */
  fullNarrationRange?: { startMs: number; endMs: number }
  castPrefaceParagraphs?: number
  illustrations?: StoryIllustration[]
}

export interface StoryVolume {
  slug: string
  number: number
  title: string
  description: string
  kind?: 'guide'
  /** Original filenames in playback order in the book's authorized media directory. */
  originalAudioFiles?: string[]
  chapters: StoryChapter[]
}

export type StoryVolumeSummary = Omit<StoryVolume, 'chapters'>

export interface StorySeries {
  language: 'en' | 'zh'
  seasonNumber?: number
  slug: string
  title: string
  author: string
  description: string
  volumes: StoryVolume[]
}

export interface StorySentence {
  id: string
  index: number
  text: string
}

export function findStorySeries(series: StorySeries[], slug: string): StorySeries | undefined {
  return series.find((entry) => entry.slug === slug)
}

export function findStoryVolume(series: StorySeries, slug: string): StoryVolume | undefined {
  return series.volumes.find((entry) => entry.slug === slug)
}

export function findStoryChapter(volume: StoryVolume, key: string): StoryChapter | undefined {
  return volume.chapters.find((entry) => entry.key === key)
}

export function hasSeparateStoryChapterNumber(chapter: Pick<StoryChapter, 'key' | 'number' | 'title'>): boolean {
  return chapter.key !== 'prologue' && chapter.key !== 'epilogue' && chapter.title !== `Chapter ${chapter.number}`
}

export function splitStorySentences(chapter: StoryChapter): StorySentence[][] {
  let sentenceIndex = 0
  const spans = chapter.unbrokenSentences?.filter(Boolean)
  const spanPattern = spans?.length
    ? new RegExp('(' + spans.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g')
    : undefined
  return chapter.paragraphs.map((paragraph) => {
    const parts = spanPattern ? paragraph.split(spanPattern) : [paragraph]
    const segments = parts.flatMap((part, index) => index % 2 === 1
      ? [part]
      : part.match(/[^.!?。！？]+(?:[.!?。！？]+(?: …)?[”’」』"']?|$)/g) ?? [part])
    return segments
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((text) => {
        sentenceIndex += 1
        return {
          id: `${chapter.key}-s${String(sentenceIndex).padStart(3, '0')}`,
          index: sentenceIndex,
          text,
        }
      })
  })
}

export function storyContentKey(volume: Pick<StoryVolume, 'slug'>, chapter?: Pick<StoryChapter, 'key'>): string {
  return chapter ? `${volume.slug}:${chapter.key}` : volume.slug
}
