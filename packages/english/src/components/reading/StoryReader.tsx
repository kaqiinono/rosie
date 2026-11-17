'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useStoryWordSources } from '../../hooks/useStoryWordSources'
import { useStageIndex } from '../../hooks/useWordData'
import { useStoryReadingProgress } from '../../hooks/useStoryReadingProgress'
import type { ReadingPassage } from '../../utils/reading-data'
import { buildEntryMatchRegex, resolveMatchedWord } from '../../utils/reading-data'
import type { StoryChapter, StoryVolume } from '../../utils/story-types'
import { splitStorySentences, storyContentKey } from '../../utils/story-types'
import PassageView from './PassageView'
import GlossaryPanel from './GlossaryPanel'
import StoryNarration from './StoryNarration'
import StoryRecorder from './StoryRecorder'
import { Button, Checkbox, Popover, SegmentedControl } from '@rosie/ui/themes'
import { StickerCard } from '@rosie/ui'

type Props = {
  seriesSlug: string
  volume: StoryVolume
  chapters: StoryChapter[]
  viewMode: 'chapter' | 'volume'
}

type VisibleSentence = { chapterKey: string; index: number; text: string; id: string }

function visibleSentences(): VisibleSentence[] {
  const topOffset = document.querySelector('[data-story-toolbar]')?.getBoundingClientRect().bottom ?? 88
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
  vocabRegex: RegExp | null,
): ReadingPassage {
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

function wordsInChapter(chapter: StoryChapter, vocab: WordEntry[], regex: RegExp | null): WordEntry[] {
  if (!regex) return []
  const text = chapter.paragraphs.join('\n')
  const matches = text.match(regex) ?? []
  const found = new Map<string, WordEntry>()
  for (const match of new Set(matches.map((text) => text.toLowerCase()))) {
    const entry = resolveMatchedWord(match, vocab)
    if (!entry) continue
    const sourceKey = [entry.stage ?? '', entry.unit, entry.lesson, entry.word.toLowerCase()].join(
      '::',
    )
    if (!found.has(sourceKey)) found.set(sourceKey, entry)
  }
  return [...found.values()]
}

export default function StoryReader(props: Props) {
  const { user } = useAuth()
  return <AccountStoryReader key={user?.id ?? 'guest'} {...props} />
}

function AccountStoryReader({ seriesSlug, volume, chapters, viewMode }: Props) {
  const { user } = useAuth()
  const { stages, error: stageError, isLoading: loadingStages } = useStageIndex(user)
  const { selected, words: vocab, toggle, load, status } = useStoryWordSources(user?.id)
  const { progress, saveProgress } = useStoryReadingProgress(user, volume.slug)
  const [glossary, setGlossary] = useState<ReadingPassage['glossary']>([])
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('focus')
  const [recordChapter, setRecordChapter] = useState<StoryChapter | null>(null)
  const [recordBusy, setRecordBusy] = useState(false)
  const [bookmarkState, setBookmarkState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const restoredRef = useRef(false)

  const matcher = useMemo(() => buildEntryMatchRegex(vocab), [vocab])
  const prepared = useMemo(
    () =>
      chapters.map((chapter) => ({
        chapter,
        passage: storyPassage(volume, chapter, matcher),
        sentences: splitStorySentences(chapter),
        chapterWords: wordsInChapter(chapter, vocab, matcher),
      })),
    [chapters, volume, vocab, matcher],
  )

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

  const currentChapter = useCallback(() => {
    const visibleChapterKey = visibleSentences()[0]?.chapterKey
    const viewportMiddle = window.innerHeight / 2
    const nearestChapter = [...prepared]
      .reverse()
      .find(
        (entry) =>
          (document.getElementById(entry.chapter.key)?.getBoundingClientRect().top ?? Infinity) <=
          viewportMiddle,
      )
    return (
      prepared.find((entry) => entry.chapter.key === visibleChapterKey) ??
      nearestChapter ??
      prepared[0]
    )
  }, [prepared])

  return (
    <div className="space-y-6">
      <StickerCard
        size="sm"
        elevation="sm"
        radius="md"
        data-story-toolbar
        className="sticky top-0 z-30 flex flex-wrap items-center gap-2"
      >
        <SegmentedControl.Root
          aria-label="阅读模式"
          value={readingMode}
          onValueChange={value => {
            if (value === 'focus' || value === 'learn') setReadingMode(value)
          }}
          size="2"
          radius="full"
        >
          <SegmentedControl.Item value="learn">学习</SegmentedControl.Item>
          <SegmentedControl.Item value="focus">专注</SegmentedControl.Item>
        </SegmentedControl.Root>
        <div className="flex flex-wrap items-center gap-2">
          <StoryNarration key={`${seriesSlug}/${volume.slug}/${viewMode}/${chapters[0]?.key}`}
            series={seriesSlug} volume={volume.slug} chapters={chapters} full={viewMode === 'volume'} />
          <Button variant="soft" highContrast color="amber" disabled={recordBusy}
            aria-expanded={!!recordChapter}
            onClick={() => setRecordChapter(recordChapter ? null : currentChapter()?.chapter ?? null)}>
            🎙 录制
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft" highContrast color="gray">词库 ▾</Button>
            </Popover.Trigger>
            <Popover.Content align="end" sideOffset={8} aria-label="词库来源"
              style={{ width: 'min(20rem, calc(100vw - 2rem))' }}>
              <fieldset className="grid grid-cols-2 gap-3">
                <legend className="mb-2 font-bold">词库来源</legend>
                {stages.map((stage) => (
                  <label key={stage} className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox checked={selected.includes(stage)} onCheckedChange={() => toggle(stage)} />
                    {stage}
                  </label>
                ))}
                <Button className="col-span-2" variant="soft" highContrast disabled={status === 'loading' || !stages.some((stage) => selected.includes(stage))}
                  onClick={() => void load(stages)}>
                  {status === 'loading' ? '加载中…' : '加载所选词库'}
                </Button>
                <span role="status" className="col-span-2 empty:hidden text-sm">
                  {stageError ? '获取词库列表失败' : loadingStages ? '正在获取词库列表…'
                    : status === 'error' ? '加载失败，请重试' : status === 'loaded' ? '词库已加载' : ''}
                </span>
              </fieldset>
            </Popover.Content>
          </Popover.Root>
          {combinedGlossary.length > 0 && (
            <Button
              type="button"
              onClick={() => setGlossary(currentChapter()?.passage.glossary ?? [])}
              variant="soft"
              color="gray"
              size="2"
            >
              📒 本章难点词
            </Button>
          )}
          <Button
            type="button"
            title="标记从这里离开"
            onClick={() => void markPosition()}
            disabled={bookmarkState === 'saving'}
            variant="soft"
            highContrast
            className="font-bold"
            color="amber"
            size="2"
          >
            {bookmarkState === 'saving'
              ? '保存中…'
              : bookmarkState === 'saved'
                ? '✓ 已标记'
                : '🔖 书签'}
          </Button>
        </div>
        {recordChapter && (
          <div className="max-h-[45dvh] w-full overflow-y-auto border-t border-kid-line pt-2">
            <StoryRecorder
              key={recordChapter.key}
              contentKey={storyContentKey(volume, recordChapter)}
              scope="chapter"
              title={`${volume.title} — ${recordChapter.title}`}
              downloadName={`${volume.title.replace(/\s+/g, '-')}-${String(recordChapter.number).padStart(2, '0')}-${recordChapter.title.replace(/\s+/g, '-')}.mp3`}
              heading={<strong>第 {recordChapter.number} 章 · {recordChapter.title}</strong>}
              onBusyChange={setRecordBusy}
            />
          </div>
        )}
        {bookmarkState === 'error' && (
          <span role="alert" className="text-xs font-bold text-rose-600">
            当前位置标记失败，请稍后重试
          </span>
        )}
      </StickerCard>

      <GlossaryPanel
        open={Boolean(glossary)}
        onClose={() => setGlossary([])}
        glossary={glossary ?? []}
      />

      {prepared.map(({ chapter, passage, sentences, chapterWords }) => (
        <StickerCard
          as="section"
          size="none"
          elevation="sm"
          radius="md"
          className="overflow-hidden"
          key={chapter.key}
          id={chapter.key}
        >
          <header className="bg-orange-50 p-5 sm:px-7">
            <p className="text-xs font-extrabold tracking-wider text-amber-700">第 {chapter.number} 章</p>
            <h1 className="font-fredoka mt-1 text-2xl font-black text-slate-900">{chapter.title}</h1>
          </header>
          <div className="border-t border-amber-100 p-5 sm:p-7">
            <PassageView
              passage={passage}
              lessonWords={chapterWords}
              masteryMap={{}}
              sentenceGroups={sentences}
              mode={readingMode}
            />
          </div>
        </StickerCard>
      ))}
    </div>
  )
}
