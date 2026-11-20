'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { STORY_CEFR_LEVELS, useStoryCefrWords } from '../../hooks/useStoryCefrWords'
import { useStoryWordSources } from '../../hooks/useStoryWordSources'
import { useStageIndex } from '../../hooks/useWordData'
import { useStoryReadingProgress } from '../../hooks/useStoryReadingProgress'
import { useStorySentencePreview } from '../../hooks/useStorySentencePreview'
import type { ReadingPassage } from '../../utils/reading-data'
import { buildEntryMatchRegex, resolveMatchedWord } from '../../utils/reading-data'
import type { StoryChapter, StoryVolume } from '../../utils/story-types'
import { splitStorySentences, storyContentKey } from '../../utils/story-types'
import type { VocabularyLevel } from '../../utils/vocabulary-assessment'
import { getWordFormCandidates } from '../../utils/word-forms'
import PassageView from './PassageView'
import GlossaryPanel from './GlossaryPanel'
import StoryNarration, { useStoryNarration } from './StoryNarration'
import StoryRecorder from './StoryRecorder'
import { Button, Checkbox, IconButton, Popover, SegmentedControl } from '@rosie/ui/themes'
import { LearningIcon, StickerCard } from '@rosie/ui'

type Props = {
  seriesSlug: string
  volume: StoryVolume
  chapters: StoryChapter[]
  viewMode: 'chapter' | 'volume'
}

type VisibleSentence = { chapterKey: string; index: number; text: string; id: string }
type SentenceSelection = { source: string; firstId: string; lastId?: string }

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

function wordsInChapter(chapter: StoryChapter, byForm: Map<string, WordEntry[]>, regex: RegExp | null): WordEntry[] {
  if (!regex) return []
  const text = chapter.paragraphs.join('\n')
  const matches = text.match(regex) ?? []
  const found = new Map<string, WordEntry>()
  for (const match of new Set(matches.map((text) => text.toLowerCase()))) {
    const candidates = byForm.get(match)
    const entry = candidates && resolveMatchedWord(match, candidates)
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
  const narration = useStoryNarration({ series: seriesSlug, volume: volume.slug, chapters, full: viewMode === 'volume' })
  const [sentencePreview, setSentencePreview] = useState(false)
  const [multiSelect, setMultiSelect] = useState(false)
  const [sentenceSelection, setSentenceSelection] = useState<SentenceSelection | null>(null)
  const preview = useStorySentencePreview(sentencePreview ? narration.current : undefined)
  const previewSource = narration.current?.src
  const selection = sentenceSelection?.source === previewSource ? sentenceSelection : null
  const selectingSentences = sentencePreview && multiSelect
  const { stages, error: stageError, isLoading: loadingStages } = useStageIndex(user)
  const { selected, words: sourceWords, toggle, load, status } = useStoryWordSources(user?.id)
  const [filterMode, setFilterMode] = useState<'cefr' | 'library'>('library')
  const [cefrLevel, setCefrLevel] = useState<VocabularyLevel | null>(null)
  const { words: cefrWords, status: cefrStatus, retry: retryCefr } = useStoryCefrWords(user?.id, cefrLevel)
  const byLevel = filterMode === 'cefr'
  const vocab = byLevel ? cefrWords : sourceWords
  const { progress, saveProgress } = useStoryReadingProgress(user, volume.slug)
  const [glossary, setGlossary] = useState<ReadingPassage['glossary']>([])
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('focus')
  const [recordChapter, setRecordChapter] = useState<StoryChapter | null>(null)
  const [recordBusy, setRecordBusy] = useState(false)
  const [narrationErrorHost, setNarrationErrorHost] = useState<HTMLDivElement | null>(null)
  const [bookmarkState, setBookmarkState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const restoredRef = useRef(false)

  const { matcher, byForm } = useMemo(() => {
    const byForm = new Map<string, WordEntry[]>()
    for (const entry of vocab) {
      for (const { text } of getWordFormCandidates(entry)) {
        const key = text.toLowerCase()
        const entries = byForm.get(key)
        if (entries) entries.push(entry)
        else byForm.set(key, [entry])
      }
    }
    return { matcher: buildEntryMatchRegex(vocab), byForm }
  }, [vocab])
  const prepared = useMemo(
    () =>
      chapters.map((chapter) => ({
        chapter,
        passage: storyPassage(volume, chapter, matcher),
        sentences: splitStorySentences(chapter),
        chapterWords: wordsInChapter(chapter, byForm, matcher),
      })),
    [chapters, volume, byForm, matcher],
  )
  const timedSentenceIds = useMemo(() => {
    const cues = preview.cues
    if (!selectingSentences || !cues?.size) return []
    return prepared.flatMap(({ sentences }) => sentences.flat()
      .filter(({ id }) => cues.has(id))
      .map(({ id }) => id))
  }, [prepared, preview.cues, selectingSentences])
  const selectedSentenceIds = useMemo(() => {
    if (!selection) return []
    const first = timedSentenceIds.indexOf(selection.firstId)
    const last = selection.lastId ? timedSentenceIds.indexOf(selection.lastId) : first
    return first < 0 || last < 0 ? [] : timedSentenceIds.slice(Math.min(first, last), Math.max(first, last) + 1)
  }, [selection, timedSentenceIds])
  const selectedSentences = useMemo(() => new Set(selectedSentenceIds), [selectedSentenceIds])

  function selectSentence(id: string) {
    if (!previewSource) return
    setSentenceSelection((previous) => {
      if (!previous || previous.source !== previewSource || previous.lastId || !timedSentenceIds.includes(previous.firstId)) {
        return { source: previewSource, firstId: id }
      }
      return previous.firstId === id ? null : { ...previous, lastId: id }
    })
  }

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

  const hasGlossary = prepared.some(({ chapter, passage }) =>
    (byLevel ? chapter.glossary : passage.glossary)?.length,
  )

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
      <video ref={preview.audioRef} hidden playsInline preload="none"
        onTimeUpdate={preview.syncPlayback} onSeeked={preview.syncPlayback} />
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
          <StoryNarration narration={narration} errorHost={narrationErrorHost} beforePlayback={preview.stop} />
          {narration.current && (
            <Button
              type="button"
              variant={sentencePreview ? 'solid' : 'soft'}
              color="orange"
              aria-pressed={sentencePreview}
              onClick={() => {
                if (sentencePreview) preview.stop()
                setSentencePreview(!sentencePreview)
              }}
            >
              单句试听
            </Button>
          )}
          {sentencePreview && narration.current && (
            <Button type="button" color="orange" variant={multiSelect ? 'solid' : 'soft'}
              aria-pressed={multiSelect} onClick={() => {
                preview.stop()
                setMultiSelect(!multiSelect)
              }}>
              多选
            </Button>
          )}
          <Button variant="soft" highContrast color="amber" disabled={recordBusy}
            aria-expanded={!!recordChapter}
            onClick={() => setRecordChapter(recordChapter ? null : currentChapter()?.chapter ?? null)}>
            🎙 录制
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft" highContrast color="gray">
                {byLevel ? (cefrLevel ? `CEFR ${cefrLevel}` : '等级') : '词库'} ▾
              </Button>
            </Popover.Trigger>
            <Popover.Content align="end" sideOffset={8} aria-label="单词高亮筛选"
              style={{ width: 'min(20rem, calc(100vw - 2rem))' }}>
              <SegmentedControl.Root
                aria-label="高亮方式"
                className="mb-4 w-full"
                value={filterMode}
                onValueChange={(value) => {
                  if (value === 'cefr' || value === 'library') setFilterMode(value)
                }}
              >
                <SegmentedControl.Item value="cefr">按等级</SegmentedControl.Item>
                <SegmentedControl.Item value="library">按词库</SegmentedControl.Item>
              </SegmentedControl.Root>
              {byLevel ? (
                <fieldset className="grid gap-3">
                  <legend className="mb-2 font-bold">CEFR 等级</legend>
                  <SegmentedControl.Root
                    aria-label="CEFR 等级"
                    value={cefrLevel ?? ''}
                    onValueChange={(value) => setCefrLevel(STORY_CEFR_LEVELS.find((level) => level === value) ?? null)}
                  >
                    {STORY_CEFR_LEVELS.map((level) => (
                      <SegmentedControl.Item key={level} value={level}>{level}</SegmentedControl.Item>
                    ))}
                  </SegmentedControl.Root>
                  <p role="status" className="text-sm text-text-secondary">
                    {cefrStatus === 'loading' ? '正在加载等级词汇…'
                      : cefrStatus === 'error' ? '等级词汇加载失败。'
                      : cefrStatus === 'loaded' && !prepared.some(({ chapterWords }) => chapterWords.length) ? '当前正文没有匹配该等级的词汇。'
                      : '按已审核的 CEFR 等级高亮匹配词形。'}
                  </p>
                  {cefrStatus === 'error' && <Button variant="soft" onClick={retryCefr}>重试</Button>}
                </fieldset>
              ) : (
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
              )}
            </Popover.Content>
          </Popover.Root>
          {hasGlossary && (
            <Button
              type="button"
              onClick={() => {
                const current = currentChapter()
                setGlossary((byLevel ? current?.chapter.glossary : current?.passage.glossary) ?? [])
              }}
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
        {selectingSentences && narration.current && (
          <div role="group" aria-label="多句试听" className="flex w-full flex-wrap items-center gap-2">
            <Button type="button" color="orange" disabled={!preview.playing && !selectedSentenceIds.length}
              onClick={() => {
                if (preview.playing) preview.stop()
                else void preview.play(selectedSentenceIds)
              }}>
              {preview.playing ? '停止播放' : `播放已选（${selectedSentenceIds.length} 句）`}
            </Button>
            <Button type="button" variant="soft" color="gray" disabled={preview.playing || !selectedSentenceIds.length}
              onClick={() => setSentenceSelection(null)}>
              清空
            </Button>
            {!preview.playing && timedSentenceIds.length > 0 && (
              <span className="text-sm text-text-secondary">
                {selection?.lastId ? '再次点击句尾可重新选段' : selection ? '再选一句确定范围' : '点击首尾两句选定范围'}
              </span>
            )}
          </div>
        )}
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
        {sentencePreview && preview.loading && <p role="status" className="w-full text-sm">正在读取逐句时间轴…</p>}
        {sentencePreview && !preview.timingError && preview.cues?.size === 0 && (
          <p role="status" className="w-full text-sm">
            当前录音没有逐句时间轴。{narration.choices.length > 1 ? '可以在朗读音频中选择其他录音。' : null}
          </p>
        )}
        {sentencePreview && (preview.timingError || preview.playbackError) && (
          <p role="alert" className="w-full text-sm font-bold text-rose-700">
            {preview.playbackError || '逐句时间轴读取失败，请重新开启单句试听。'}
          </p>
        )}
        <div ref={setNarrationErrorHost} className="w-full empty:hidden" />
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
              cefrLevel={byLevel ? cefrLevel ?? undefined : undefined}
              listeningTarget={preview.activeId ?? undefined}
              renderStorySentenceControl={preview.cues?.size ? (sentence) => {
                if (!preview.cues?.has(sentence.id)) return null
                if (selectingSentences) {
                  return (
                    <span className="relative inline-block size-0 align-baseline">
                      <label className="absolute bottom-3 left-0 z-10 grid size-6 -translate-x-1/4 place-items-center">
                        <Checkbox color="orange" size="1" checked={selectedSentences.has(sentence.id)}
                          aria-label={`选择第 ${sentence.index} 句`} disabled={preview.playing}
                          onCheckedChange={() => selectSentence(sentence.id)} />
                      </label>
                    </span>
                  )
                }
                const active = preview.activeId === sentence.id
                const label = active ? `停止试听第 ${sentence.index} 句` : `试听第 ${sentence.index} 句`
                return (
                  <IconButton type="button" size="2" radius="full" color="orange"
                    variant={active ? 'solid' : 'soft'} className="mx-1 align-middle"
                    aria-label={label} title={label} onClick={() => {
                      if (active) preview.stop()
                      else void preview.play([sentence.id])
                    }}>
                    <LearningIcon name={active ? 'pause' : 'listen'} size={16} />
                  </IconButton>
                )
              } : undefined}
            />
          </div>
        </StickerCard>
      ))}
    </div>
  )
}
