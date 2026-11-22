'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { STORY_CEFR_LEVELS, useStoryCefrWords } from '../../hooks/useStoryCefrWords'
import { useStoryWordSources } from '../../hooks/useStoryWordSources'
import { useStageIndex } from '../../hooks/useWordData'
import { useStoryReadingProgress } from '../../hooks/useStoryReadingProgress'
import { useStorySentencePreview } from '../../hooks/useStorySentencePreview'
import type { ReadingPassage } from '../../utils/reading-data'
import { buildEntryMatchRegex, buildGlossaryRegex, resolveGlossaryMatch, resolveMatchedWord } from '../../utils/reading-data'
import type { StoryChapter, StoryVolume } from '../../utils/story-types'
import { hasSeparateStoryChapterNumber, splitStorySentences, storyContentKey } from '../../utils/story-types'
import type { VocabularyLevel } from '../../utils/vocabulary-assessment'
import { getWordFormCandidates } from '../../utils/word-forms'
import PassageView from './PassageView'
import GlossaryPanel from './GlossaryPanel'
import StoryNarration, { useStoryNarration } from './StoryNarration'
import StoryListeningPanel from './StoryListeningPanel'
import StoryRecorder from './StoryRecorder'
import { Button, Checkbox, Popover, SegmentedControl, Switch } from '@rosie/ui/themes'
import { Check, LearningIcon, StickerCard } from '@rosie/ui'

type Props = {
  seriesSlug: string
  volume: Pick<StoryVolume, 'slug' | 'title' | 'kind' | 'originalAudioFiles'>
  chapters: StoryChapter[]
  viewMode: 'chapter' | 'volume'
}

const StoryPassageView = memo(PassageView)
const emptyMasteryMap = {}

function storyViewport(reader: HTMLElement) {
  return {
    top: reader.querySelector('[data-story-toolbar]')?.getBoundingClientRect().bottom ?? 0,
    bottom: reader.querySelector('[data-story-reading-controls]')?.getBoundingClientRect().top ?? window.innerHeight,
  }
}

function visibleSentences(reader: HTMLElement, candidates = reader.querySelectorAll<HTMLElement>('[data-story-sentence]')) {
  const { top, bottom } = storyViewport(reader)
  const fullyVisible: HTMLElement[] = []
  const partlyVisible: HTMLElement[] = []
  for (const element of candidates) {
    const rect = element.getBoundingClientRect()
    if (rect.bottom > top && rect.top < bottom) partlyVisible.push(element)
    if (rect.top >= top && rect.bottom <= bottom) fullyVisible.push(element)
  }
  return fullyVisible.length ? fullyVisible : partlyVisible
}

function storyPassage(
  volume: Pick<StoryVolume, 'slug' | 'title'>,
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
  const readerKey = `${user?.id ?? 'guest'}:${props.seriesSlug}:${props.volume.slug}:${props.viewMode}:${props.chapters[0]?.key ?? ''}`
  return <AccountStoryReader key={readerKey} {...props} />
}

function AccountStoryReader({ seriesSlug, volume, chapters, viewMode }: Props) {
  const { user } = useAuth()
  const sectionUnit = volume.kind === 'guide' ? '节' : '章'
  const narration = useStoryNarration({ series: seriesSlug, volume, chapters, full: viewMode === 'volume' })
  const [listeningAnchor, setListeningAnchor] = useState<string | null>(null)
  const listeningOpen = listeningAnchor !== null
  const [glossaryChapterKey, setGlossaryChapterKey] = useState<string | null>(null)
  const [glossaryAudioId, setGlossaryAudioId] = useState<string | null>(null)
  const preview = useStorySentencePreview(listeningOpen || glossaryChapterKey !== null ? narration.previewTracks : undefined)
  const { stages, error: stageError, isLoading: loadingStages } = useStageIndex(user)
  const { selected, words: sourceWords, toggle, load, status } = useStoryWordSources(user?.id)
  const [filterMode, setFilterMode] = useState<'cefr' | 'library'>('library')
  const [cefrLevels, setCefrLevels] = useState<VocabularyLevel[]>([])
  const { words: cefrWords, cefrLabels, status: cefrStatus, retry: retryCefr } = useStoryCefrWords(user?.id, cefrLevels)
  const byLevel = filterMode === 'cefr'
  const cefrFilterLabel = cefrLevels.length > 1 ? `CEFR · ${cefrLevels.length} 级`
    : cefrLevels.length === 1 ? `CEFR ${cefrLevels[0]}` : '等级'
  const vocab = byLevel ? cefrWords : sourceWords
  const { progress, saveProgress } = useStoryReadingProgress(user, volume.slug)
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('focus')
  const [largeText, setLargeText] = useState(false)
  const readerRef = useRef<HTMLDivElement>(null)
  const [recordChapter, setRecordChapter] = useState<StoryChapter | null>(null)
  const [recordBusy, setRecordBusy] = useState(false)
  const [narrationErrorHost, setNarrationErrorHost] = useState<HTMLDivElement | null>(null)
  const [bookmarkState, setBookmarkState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const restoredRef = useRef(false)
  const bookmarkRestoreFrame = useRef(0)

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
  const glossaryChapter = prepared.find(({ chapter }) => chapter.key === glossaryChapterKey)
  const glossarySentenceIds = useMemo(() => {
    const ids = new Map<string, string>()
    const cues = preview.cues
    if (!glossaryChapter || !cues?.size) return ids
    const timedSentences = glossaryChapter.sentences.flat().filter((sentence) => cues.has(sentence.id))
    for (const entry of glossaryChapter.chapter.glossary) {
      const entries = [entry]
      const matcher = buildGlossaryRegex(entries)
      if (!matcher) continue
      const sentence = timedSentences.find(({ text }) =>
        text.match(matcher)?.some((match) => resolveGlossaryMatch(match, entries)),
      )
      if (sentence) ids.set(entry.word, sentence.id)
    }
    return ids
  }, [glossaryChapter, preview.cues])

  function stopGlossaryAudio() {
    preview.stop()
    setGlossaryAudioId(null)
  }

  function toggleGlossaryAudio(sentenceId: string) {
    if (glossaryAudioId === sentenceId && preview.playing) {
      stopGlossaryAudio()
      return
    }
    window.speechSynthesis?.cancel()
    setGlossaryAudioId(sentenceId)
    void preview.play([sentenceId])
  }
  const { listeningClips, orderById } = useMemo(() => {
    const cues = preview.cues
    const listeningClips: { id: string; text: string; chapterKey: string; order: number }[] = []
    const orderById = new Map<string, number>()
    if (listeningOpen && cues?.size) {
      for (const { chapter, sentences } of prepared) {
        for (const { id, text } of sentences.flat()) {
          const order = orderById.size
          orderById.set(id, order)
          if (cues.has(id)) listeningClips.push({ id, text, chapterKey: chapter.key, order })
        }
      }
    }
    return { listeningClips, orderById }
  }, [listeningOpen, prepared, preview.cues])
  const listeningOrder = listeningAnchor ? (orderById.get(listeningAnchor) ?? 0) : 0
  const nextListeningIndex = listeningClips.findIndex(({ order }) => order >= listeningOrder)
  const listeningIndex = nextListeningIndex < 0 ? Math.max(0, listeningClips.length - 1) : nextListeningIndex
  const preloadSentenceId = listeningClips[listeningIndex]?.id
  const { preload } = preview
  const playbackId = listeningOpen && !glossaryAudioId ? preview.lastPlayedId : null
  const playingClip = playbackId ? listeningClips.find(({ id }) => id === playbackId) : undefined
  const listeningSentence = playingClip ?? listeningClips[listeningIndex]
  const listeningSentenceId = listeningSentence?.id
  const focusedSentenceId = listeningSentenceId
  const focusedChapterKey = listeningSentence?.chapterKey

  useEffect(() => preload(preloadSentenceId), [preload, preloadSentenceId])

  function closeListening() {
    preview.stop()
    setListeningAnchor(null)
  }

  function toggleListening() {
    if (listeningOpen) {
      closeListening()
      return
    }
    stopGlossaryAudio()
    const reader = readerRef.current
    restoredRef.current = true
    cancelAnimationFrame(bookmarkRestoreFrame.current)
    reader?.querySelector('[data-story-sentence].reading-flash')?.classList.remove('reading-flash')
    setListeningAnchor((reader && visibleSentences(reader)[0]?.id) ?? '')
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
    bookmarkRestoreFrame.current = requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' })
      target.classList.add('reading-flash')
      window.setTimeout(() => target.classList.remove('reading-flash'), 2000)
    })
  }, [chapters, progress])

  useLayoutEffect(() => {
    const reader = readerRef.current
    const panel = reader?.querySelector('[data-story-reading-controls]')
    if (!listeningOpen || !reader || !panel) return

    const follow = () => {
      reader.style.setProperty('--story-listening-height', `${panel.getBoundingClientRect().height}px`)
      const target = listeningSentenceId && document.getElementById(listeningSentenceId)
      if (!target) return
      const { top, bottom } = storyViewport(reader)
      const rect = target.getBoundingClientRect()
      if (rect.top >= top && rect.bottom <= bottom) return
      window.scrollBy({ top: rect.top - top - Math.max(0, (bottom - top - rect.height) / 2), behavior: 'instant' })
    }
    follow()
    const observer = new ResizeObserver(follow)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [listeningOpen, listeningSentenceId])

  const markPosition = useCallback(async () => {
    const reader = readerRef.current
    if (!reader) return
    const current = focusedSentenceId && document.getElementById(focusedSentenceId)
    const visible = current ? [current] : visibleSentences(reader)
    const first = visible[0]
    const last = visible.at(-1)
    if (!first || !last) {
      setBookmarkState('error')
      return
    }
    setBookmarkState('saving')
    const result = await saveProgress({
      chapterKey: first.dataset.chapterKey ?? '',
      startSentenceIndex: Number(first.dataset.sentenceIndex),
      startSentenceText: first.dataset.sentenceText ?? '',
      endSentenceIndex: Number(last.dataset.sentenceIndex),
      endSentenceText: last.dataset.sentenceText ?? '',
      viewMode,
    })
    setBookmarkState(result.error ? 'error' : 'saved')
    if (!result.error) window.setTimeout(() => setBookmarkState('idle'), 1800)
  }, [focusedSentenceId, saveProgress, viewMode])

  const hasGlossary = chapters.some((chapter) => chapter.glossary.length > 0)

  const currentChapter = useCallback(() => {
    const reader = readerRef.current
    const chapterKey = focusedChapterKey ?? (reader && visibleSentences(reader)[0]?.dataset.chapterKey)
    const viewportMiddle = window.innerHeight / 2
    const nearestChapter = [...prepared]
      .reverse()
      .find(
        (entry) =>
          (document.getElementById(entry.chapter.key)?.getBoundingClientRect().top ?? Infinity) <=
          viewportMiddle,
      )
    return (
      prepared.find((entry) => entry.chapter.key === chapterKey) ??
      nearestChapter ??
      prepared[0]
    )
  }, [prepared, focusedChapterKey])

  return (
    <div
      ref={readerRef}
      data-story-reading-mode={listeningOpen ? '' : undefined}
      className={listeningOpen ? 'space-y-6 pb-[calc(var(--story-listening-height,5rem)_+_env(safe-area-inset-bottom,0px))]' : 'space-y-6'}
    >
      <video ref={preview.audioRef} hidden playsInline preload={listeningOpen ? 'auto' : 'none'}
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
        <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-text-primary">
          <Switch checked={largeText} onCheckedChange={setLargeText} color="orange" />
          大字
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <StoryNarration narration={narration} errorHost={narrationErrorHost} beforePlayback={preview.stop}
            inlinePlayer={listeningOpen} />
          {narration.previewTracks.length > 0 && (
            <Button
              type="button"
              variant={listeningOpen ? 'solid' : 'soft'}
              color="orange"
              aria-expanded={listeningOpen}
              onClick={toggleListening}
            >
              逐句模式
            </Button>
          )}
          <Button variant="soft" highContrast color="amber" disabled={recordBusy}
            aria-expanded={!!recordChapter}
            onClick={() => setRecordChapter(recordChapter ? null : currentChapter()?.chapter ?? null)}>
            <span className="inline-flex items-center gap-1">
              <LearningIcon name="record" size={16} />
              录制
            </span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft" highContrast color="gray">
                {byLevel ? cefrFilterLabel : '词库'} ▾
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
                <fieldset className="grid grid-cols-3 gap-3">
                  <legend className="mb-2 font-bold">CEFR 等级</legend>
                  {STORY_CEFR_LEVELS.map((level) => (
                    <label key={level} className="flex cursor-pointer items-center gap-1.5">
                      <Checkbox checked={cefrLevels.includes(level)} onCheckedChange={() => {
                        setCefrLevels((current) => current.includes(level)
                          ? current.filter((item) => item !== level)
                          : [...current, level])
                      }} />
                      {level}
                    </label>
                  ))}
                  <p role="status" className="col-span-3 text-sm text-text-secondary">
                    {cefrStatus === 'loading' ? '正在加载等级词汇…'
                      : cefrStatus === 'error' ? '等级词汇加载失败。'
                      : cefrStatus === 'loaded' && !prepared.some(({ chapterWords }) => chapterWords.length) ? '当前正文没有匹配所选等级的词汇。'
                      : '可勾选多个等级，高亮匹配的已审核词汇。'}
                  </p>
                  {cefrStatus === 'error' && <Button className="col-span-3" variant="soft" onClick={retryCefr}>重试</Button>}
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
                const chapter = currentChapter()?.chapter
                if (chapter?.glossary.length) setGlossaryChapterKey(chapter.key)
              }}
              variant="soft"
              color="gray"
              size="2"
            >
              <span className="inline-flex items-center gap-1">
                <LearningIcon name="focus" size={16} />
                难点词
              </span>
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
            {bookmarkState === 'saving' ? '保存中…' : (
              <span className="inline-flex items-center gap-1">
                {bookmarkState === 'saved' ? <Check aria-hidden size={16} /> : <LearningIcon name="bookmark" size={16} />}
                {bookmarkState === 'saved' ? '已标记' : '书签'}
              </span>
            )}
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
              heading={<strong>{hasSeparateStoryChapterNumber(recordChapter)
                ? `第 ${recordChapter.number} ${sectionUnit} · ${recordChapter.title}`
                : recordChapter.title}</strong>}
              onBusyChange={setRecordBusy}
            />
          </div>
        )}
        {bookmarkState === 'error' && (
          <span role="alert" className="text-xs font-bold text-rose-600">
            当前位置标记失败，请稍后重试
          </span>
        )}
        <div ref={setNarrationErrorHost} className="w-full empty:hidden" />
      </StickerCard>

      {listeningOpen && (
          <StoryListeningPanel key={narration.current?.src} clips={listeningClips} index={listeningIndex}
          largeText={largeText}
          playbackId={playbackId} playing={preview.playing && !glossaryAudioId} loading={preview.loading}
          error={(glossaryAudioId ? '' : preview.playbackError) || (preview.timingError ? '逐句时间轴读取失败。' : '')}
          onSelect={(index) => {
            const clip = listeningClips[index]
            if (clip) setListeningAnchor(clip.id)
          }}
          onPlay={(ids) => {
            setGlossaryAudioId(null)
            void preview.play(ids)
          }}
          onStop={preview.stop} onClose={closeListening} />
      )}

      <GlossaryPanel
        open={Boolean(glossaryChapter?.chapter.glossary.length)}
        onClose={() => {
          if (glossaryAudioId) stopGlossaryAudio()
          setGlossaryChapterKey(null)
        }}
        glossary={glossaryChapter?.chapter.glossary ?? []}
        originalAudio={{
          sentenceIds: glossarySentenceIds,
          activeId: glossaryAudioId ? preview.activeId : null,
          error: preview.timingError ? '原句时间轴加载失败，请重新打开难点词。'
            : glossaryAudioId ? preview.playbackError : '',
          onToggle: toggleGlossaryAudio,
          onStop: stopGlossaryAudio,
        }}
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
          <StoryPassageView
            passage={passage}
            lessonWords={chapterWords}
            masteryMap={emptyMasteryMap}
            storyChapter={chapter}
            storySectionUnit={sectionUnit}
            sentenceGroups={sentences}
            mode={readingMode}
            cefrLabels={byLevel ? cefrLabels : undefined}
            listeningTarget={preview.activeId ?? undefined}
            storyReadingSentenceId={chapter.key === focusedChapterKey ? focusedSentenceId : undefined}
            largeText={largeText}
          />
        </StickerCard>
      ))}
    </div>
  )
}
