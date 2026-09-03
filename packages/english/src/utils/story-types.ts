import type { GlossaryWord } from './reading-data'

export interface StoryChapter {
  key: string
  number: number
  title: string
  paragraphs: string[]
  glossary: GlossaryWord[]
}

export interface StoryVolume {
  slug: string
  number: number
  title: string
  description: string
  chapters: StoryChapter[]
}

export interface StorySeries {
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

export function splitStorySentences(chapter: StoryChapter): StorySentence[][] {
  let sentenceIndex = 0
  return chapter.paragraphs.map((paragraph) => {
    const segments = paragraph.match(/[^.!?]+(?:[.!?]+[”’"']?|$)/g) ?? [paragraph]
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

export function storyContentKey(volume: StoryVolume, chapter?: StoryChapter): string {
  return chapter ? `${volume.slug}:${chapter.key}` : volume.slug
}
