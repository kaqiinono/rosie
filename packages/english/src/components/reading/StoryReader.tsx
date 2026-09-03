'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useWordData } from '../../hooks/useWordData'
import { useStoryReadingProgress } from '../../hooks/useStoryReadingProgress'
import type { ReadingPassage } from '../../utils/reading-data'
import { buildEntryMatchRegex, resolveMatchedWord } from '../../utils/reading-data'
import type { StoryChapter, StoryVolume } from '../../utils/story-types'
import { splitStorySentences, storyContentKey } from '../../utils/story-types'
import PassageView from './PassageView'
import GlossaryPanel from './GlossaryPanel'
import StoryRecorder from './StoryRecorder'

type Props = {
  volume: StoryVolume
  chapters: StoryChapter[]
  viewMode: 'chapter' | 'volume'
}

type VisibleSentence = { chapterKey: string; index: number; text: string; id: string }

function visibleSentences(): VisibleSentence[] {
  const topOffset = 88
  const height = window.innerHeight
  const all = [...document.querySelectorAll<HTMLElement>('[data-story-sentence]')]
  const fullyVisible = all.filter((element) => {
    const rect = element.getBoundingClientRect()
    return rect.top >= topOffset && rect.bottom <= height
  })
  const candidates =
    fullyVisible.length > 0
      ? fullyVisible
      : all.filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.bottom > topOffset && rect.top < height
        })
  return candidates.map((element) => ({
    chapterKey: element.dataset.chapterKey ?? '',
    index: Number(element.dataset.sentenceIndex),
    text: element.dataset.sentenceText ?? '',
    id: element.id,
  }))
}

function storyPassage(
  volume: StoryVolume,
  chapter: StoryChapter,
  vocab: WordEntry[],
): ReadingPassage {
  const vocabRegex = buildEntryMatchRegex(vocab)
  const glossary = chapter.glossary.filter((entry) => {
    if (!vocabRegex) return true
    return !new RegExp(vocabRegex.source, vocabRegex.flags).test(entry.word)
  })
  return {
    key: `${volume.slug}-${chapter.key}`,
    stage: 'story',
    unit: volume.title,
    lesson: chapter.key,
    title: chapter.title,
    paragraphs: chapter.paragraphs,
    glossary,
  }
}

function wordsInChapter(chapter: StoryChapter, vocab: WordEntry[]): WordEntry[] {
  const regex = buildEntryMatchRegex(vocab)
  if (!regex) return []
  const text = chapter.paragraphs.join('\n')
  const matches = text.match(regex) ?? []
  const found = new Map<string, WordEntry>()
  for (const match of matches) {
    const entry = resolveMatchedWord(match, vocab)
    if (!entry) continue
    const sourceKey = [entry.stage ?? '', entry.unit, entry.lesson, entry.word.toLowerCase()].join(
      '::',
    )
    if (!found.has(sourceKey)) found.set(sourceKey, entry)
  }
  return [...found.values()]
}

export default function StoryReader({ volume, chapters, viewMode }: Props) {
  const { user } = useAuth()
  const { vocab, isLoading: vocabLoading } = useWordData(user)
  const { progress, saveProgress } = useStoryReadingProgress(user, volume.slug)
  const [glossary, setGlossary] = useState<ReadingPassage['glossary']>([])
  const [bookmarkState, setBookmarkState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const restoredRef = useRef(false)

  const prepared = useMemo(
    () =>
      chapters.map((chapter) => ({
        chapter,
        passage: storyPassage(volume, chapter, vocab),
        sentences: splitStorySentences(chapter),
        chapterWords: wordsInChapter(chapter, vocab),
      })),
    [chapters, volume, vocab],
  )

  useEffect(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[data-story-sentence]')) {
      const chapter = prepared.find((entry) =>
        entry.sentences.some((paragraph) =>
          paragraph.some((sentence) => sentence.id === element.id),
        ),
      )
      if (chapter) element.dataset.chapterKey = chapter.chapter.key
    }
  }, [prepared])

  useEffect(() => {
    if (!progress || restoredRef.current) return
    if (!chapters.some((chapter) => chapter.key === progress.chapterKey)) return
    restoredRef.current = true
    const expectedId = `${progress.chapterKey}-s${String(progress.startSentenceIndex).padStart(3, '0')}`
    const byId = document.getElementById(expectedId)
    const byText = [...document.querySelectorAll<HTMLElement>('[data-story-sentence]')].find(
      (element) => element.dataset.sentenceText === progress.startSentenceText,
    )
    const target = byId?.dataset.sentenceText === progress.startSentenceText ? byId : byText
    if (!target) return
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' })
      target.classList.add('reading-flash')
      window.setTimeout(() => target.classList.remove('reading-flash'), 2000)
    })
  }, [chapters, progress])

  const markPosition = useCallback(async () => {
    const visible = visibleSentences()
    const first = visible[0]
    const last = visible.at(-1)
    if (!first || !last) {
      setBookmarkState('error')
      return
    }
    setBookmarkState('saving')
    const result = await saveProgress({
      chapterKey: first.chapterKey,
      startSentenceIndex: first.index,
      startSentenceText: first.text,
      endSentenceIndex: last.index,
      endSentenceText: last.text,
      viewMode,
    })
    setBookmarkState(result.error ? 'error' : 'saved')
    if (!result.error) window.setTimeout(() => setBookmarkState('idle'), 1800)
  }, [saveProgress, viewMode])

  const combinedGlossary = useMemo(() => {
    const seen = new Set<string>()
    return prepared
      .flatMap((entry) => entry.passage.glossary ?? [])
      .filter((entry) => {
        const key = entry.word.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [prepared])

  const openCurrentChapterGlossary = useCallback(() => {
    const visibleChapterKey = visibleSentences()[0]?.chapterKey
    const viewportMiddle = window.innerHeight / 2
    const nearestChapter = [...prepared]
      .reverse()
      .find(
        (entry) =>
          (document.getElementById(entry.chapter.key)?.getBoundingClientRect().top ?? Infinity) <=
          viewportMiddle,
      )
    const current =
      prepared.find((entry) => entry.chapter.key === visibleChapterKey) ??
      nearestChapter ??
      prepared[0]
    setGlossary(current?.passage.glossary ?? [])
  }, [prepared])

  return (
    <div className="space-y-6">
      <div className="sticky top-[112px] z-30 flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-3 shadow-sm ring-1 ring-amber-200 backdrop-blur md:top-[60px]">
        <button
          type="button"
          onClick={() => void markPosition()}
          disabled={bookmarkState === 'saving'}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {bookmarkState === 'saving'
            ? '保存中…'
            : bookmarkState === 'saved'
              ? '✓ 已标记'
              : '🔖 标记从这里离开'}
        </button>
        {combinedGlossary.length > 0 && (
          <button
            type="button"
            onClick={openCurrentChapterGlossary}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
          >
            📒 本章难点词
          </button>
        )}
        {vocabLoading && <span className="text-xs text-slate-500">正在匹配全部词库…</span>}
        {bookmarkState === 'error' && (
          <span role="alert" className="text-xs font-bold text-rose-600">
            当前位置标记失败，请稍后重试
          </span>
        )}
      </div>

      <GlossaryPanel
        open={Boolean(glossary)}
        onClose={() => setGlossary([])}
        glossary={glossary ?? []}
      />

      {prepared.map(({ chapter, passage, sentences, chapterWords }) => (
        <section
          key={chapter.key}
          id={chapter.key}
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-200"
        >
          <header className="bg-gradient-to-br from-amber-100 to-orange-50 p-5 sm:px-7">
            <StoryRecorder
              contentKey={storyContentKey(volume, chapter)}
              scope="chapter"
              title={`${volume.title} — ${chapter.title}`}
              downloadName={`Magic-Tree-House-${volume.title.replace(/\s+/g, '-')}-${String(chapter.number).padStart(2, '0')}-${chapter.title.replace(/\s+/g, '-')}.mp3`}
              heading={
                <div className="min-w-0">
                  <p className="text-xs font-extrabold tracking-wider text-amber-700 uppercase">
                    Chapter {chapter.number}
                  </p>
                  <h1 className="font-fredoka mt-1 text-2xl font-black text-slate-900">
                    {chapter.title}
                  </h1>
                </div>
              }
            />
          </header>
          <div className="border-t border-amber-100 p-5 sm:p-7">
            <PassageView
              passage={passage}
              lessonWords={chapterWords}
              masteryMap={{}}
              sentenceGroups={sentences}
              mode="focus"
            />
          </div>
        </section>
      ))}
    </div>
  )
}
