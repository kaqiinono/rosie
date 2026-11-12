'use client'

import { use, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWordsContext } from '@rosie/english'
import { useAuth, useBaiduMediaError } from '@rosie/core'
import { useWeeklyPlan } from '@rosie/english'
import { useReadingPassageAudio, useBaiduReadingAudioError } from '@rosie/english'
import { useWordData } from '@rosie/english'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import {
  findPassageByKey,
  buildEntryRegex,
  parseFocusLessonKey,
  readingPassages,
} from '@rosie/english'
import { wordKey } from '@rosie/english'
import type { MasteryLevel } from '@rosie/core'
import { todayStr } from '@rosie/core'
import type { WordEntry, WeekDayProgress } from '@rosie/core'
import {
  ListeningDrawer,
  playableListeningClips,
  lessonAudioUrl,
  useAudioSlots,
  PassageView,
} from '@rosie/english'
import { WordPopup } from '@rosie/english'
import { ParagraphRecallQuiz } from '@rosie/english'
import { UncoveredWordsReview } from '@rosie/english'
import { PreReadingRecall } from '@rosie/english'
import { GlossaryPanel } from '@rosie/english'
import { ReadingLearningSections } from '@rosie/english'
import { DarkScope, LearningIcon } from '@rosie/ui'
import { Button, Flex, IconButton, SegmentedControl, Spinner, Switch, Theme } from '@rosie/ui/themes'

const LEGEND: { level: MasteryLevel; label: string; dot: string }[] = [
  { level: 0, label: '未掌握', dot: 'bg-amber-400' },
  { level: 1, label: '学习中', dot: 'bg-sky-400' },
  { level: 2, label: '熟悉', dot: 'bg-violet-400' },
  { level: 3, label: '已掌握', dot: 'bg-emerald-400' },
]

const HOUHAI_STAGES = new Set(['4A', '5A'])

export default function ReadingPassagePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  return <ReadingPassageDetail key={key} passageKey={key} />
}

function ReadingPassageDetail({ passageKey: key }: { passageKey: string }) {
  const { masteryMap, recordRecallAttempt } = useWordsContext()
  const { user } = useAuth()
  const { vocab: fullVocab } = useWordData(user)
  const { weeklyPlan, updateDayProgress } = useWeeklyPlan(user)
  const audioUrl = useReadingPassageAudio(user, key)
  const player = usePlaylistPlayer()
  const playbackError = useBaiduMediaError(player.audioRef)
  const baiduError = useBaiduReadingAudioError(user)
  const { stop } = player
  const [loadingNarration, setLoadingNarration] = useState(false)
  const [narrationError, setNarrationError] = useState('')
  useEffect(() => stop, [stop])
  const narrationActive = player.current?.url === audioUrl
  const narrationPlaying = narrationActive && player.isPlaying && !player.isPaused
  const searchParams = useSearchParams()
  const focusWord = searchParams.get('focus')

  const passage = findPassageByKey(key)
  const { data: slots } = useAudioSlots(user)
  const clips = useMemo(() => playableListeningClips(passage, slots), [passage, slots])
  const [listening, setListening] = useState<{
    key: string
    index: number
    mode: 'inline' | 'panel' | 'closed'
  } | null>(null)
  const [listeningCollapsed, setListeningCollapsed] = useState(false)
  const [listeningPaused, setListeningPaused] = useState(false)
  const [clipReplayRequest, setClipReplayRequest] = useState(0)
  const [loadingClipIndex, setLoadingClipIndex] = useState<number | null>(null)
  const [selectedClips, setSelectedClips] = useState<number[]>([])
  const showClip = useCallback(
    (index: number) => {
      setListening({ key, index, mode: 'panel' })
      setSelectedClips((current) => (current.includes(index) ? current : [index]))
    },
    [key],
  )
  const listeningOpen = listening?.key === key && listening.mode === 'panel'
  const listeningActive = listening?.key === key && listening.mode !== 'closed'
  const clipIndex = listening?.key === key ? listening.index : 0
  const target = listeningActive ? clips[clipIndex]?.target : undefined
  const selectClip = (index: number, openPanel = false) => {
    if (loadingNarration) {
      stop()
      setLoadingNarration(false)
    } else {
      player.audioRef.current?.pause()
    }
    if (openPanel || listeningOpen) {
      if (openPanel) setListeningCollapsed(false)
      showClip(index)
    } else {
      setListening({ key, index, mode: 'inline' })
      setSelectedClips([index])
    }
  }
  const closeListening = () => setListening({ key, index: clipIndex, mode: 'closed' })
  const clipButton = (cue: string) => {
    const index = clips.findIndex((clip) => clip.target === cue)
    if (index < 0) return null
    const loading = listeningActive && !listeningPaused && clipIndex === index && loadingClipIndex === index
    return (
      <IconButton
        type="button"
        aria-label={loading ? `正在加载第 ${index + 1} 段音频` : `播放第 ${index + 1} 段音频`}
        aria-busy={loading}
        title="播放当前句"
        onClick={() => {
          setListeningPaused(false)
          setClipReplayRequest((request) => request + 1)
          selectClip(index)
        }}
        variant="ghost"
        color={target === cue ? 'orange' : 'gray'}
        m={cue === 'title' ? '0' : undefined}
        size="2"
      >
        {loading ? <Spinner aria-hidden size="1" /> : <LearningIcon name="listen" size={16} />}
      </IconButton>
    )
  }
  useEffect(() => {
    if (!listeningOpen) return
    const drawer = document.getElementById('reading-listening-drawer')
    if (!target || !drawer) return
    const follow = () => {
      const node = document.querySelector(`[data-narration-cue="${target}"]`)
      if (!node) return
      const rect = node.getBoundingClientRect()
      const bottom = drawer.getBoundingClientRect().top - 12
      const top = 80
      if (rect.top < top || rect.bottom > bottom) {
        window.scrollBy({
          top: rect.top - top - Math.max(0, (bottom - top - rect.height) / 2),
          behavior: 'instant',
        })
      }
    }
    follow()
    window.addEventListener('resize', follow)
    const observer = new ResizeObserver(follow)
    observer.observe(drawer)
    return () => {
      window.removeEventListener('resize', follow)
      observer.disconnect()
    }
  }, [target, clipIndex, listeningOpen])
  const [stripSelected, setStripSelected] = useState<WordEntry | null>(null)
  /** Two reading modes per design 2C. Defaults to 专注模式 (distraction-free reading). */
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('focus')
  const [lessonFocus, setLessonFocus] = useState(false)
  const [preReadingOpen, setPreReadingOpen] = useState(false)
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  // Mark the daily 读课文 step complete once the learner has scrolled past 50%
  // of the passage. Guarded so we only write once per page mount.
  const readingMarkedRef = useRef(false)
  const isFocusPassage = (() => {
    if (!passage || !weeklyPlan?.focusLessonKey) return false
    const parsed = parseFocusLessonKey(weeklyPlan.focusLessonKey)
    if (!parsed) return false
    if (parsed.stage && parsed.stage !== passage.stage) return false
    return parsed.unit === passage.unit && parsed.lesson === passage.lesson
  })()
  useEffect(() => {
    if (!isFocusPassage || !weeklyPlan) return
    const today = todayStr()
    const todayProgress = weeklyPlan.progress[today]
    if (todayProgress?.readingDone) {
      readingMarkedRef.current = true
      return
    }
    const onScroll = () => {
      if (readingMarkedRef.current) return
      const scrolled = window.scrollY + window.innerHeight
      const total = document.documentElement.scrollHeight
      if (total <= 0) return
      if (scrolled / total >= 0.5) {
        readingMarkedRef.current = true
        const next: WeekDayProgress = {
          ...todayProgress,
          quizDone: todayProgress?.quizDone ?? false,
          readingDone: true,
        }
        void updateDayProgress(today, next)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isFocusPassage, weeklyPlan, updateDayProgress])

  const lessonWords = useMemo(() => {
    if (!passage) return [] as WordEntry[]
    return fullVocab.filter(
      (w) => w.stage === passage.stage && w.unit === passage.unit && w.lesson === passage.lesson,
    )
  }, [fullVocab, passage])

  // 厚海阅读跨 4A/5A 两个分辑匹配；StoryReader 继续独立匹配全部词库。
  // 回想练习仍只考当前课，避免跨分辑词意外进入本课测验。
  const highlightedWords = useMemo(() => {
    if (!passage) return [] as WordEntry[]
    const passageText = passage.paragraphs.join('\n')
    const houhaiVocab = fullVocab.filter((entry) => entry.stage && HOUHAI_STAGES.has(entry.stage))
    const sourceVocab = houhaiVocab.length > 0 ? houhaiVocab : lessonWords
    const ordered = [...sourceVocab].sort((a, b) => {
      const aIsCurrent = a.stage === passage.stage ? 0 : 1
      const bIsCurrent = b.stage === passage.stage ? 0 : 1
      return aIsCurrent - bIsCurrent
    })
    const seen = new Set<string>()
    return ordered.filter((entry) => {
      const normalized = entry.word.trim().toLowerCase()
      if (!normalized || seen.has(normalized) || !buildEntryRegex(entry).test(passageText)) {
        return false
      }
      seen.add(normalized)
      return true
    })
  }, [fullVocab, lessonWords, passage])

  const visibleWords = lessonFocus ? lessonWords : highlightedWords

  // Recall outcomes drive the cute in-passage decorations (🌸 for correct,
  // 💩 for wrong). Distinct from masteryMap because we want a per-attempt visual
  // even when mastery itself doesn't advance (wrong answer doesn't penalise).
  const [recallOutcomes, setRecallOutcomes] = useState<Record<string, 'correct' | 'wrong'>>({})

  const handleRecallAnswer = useCallback(
    (entry: WordEntry, correct: boolean) => {
      setRecallOutcomes((prev) => ({ ...prev, [wordKey(entry)]: correct ? 'correct' : 'wrong' }))
      recordRecallAttempt(entry, correct)
    },
    [recordRecallAttempt],
  )

  // Recall counts per lesson word — drives lowest-count-first picker rotation
  // and the subtle ✓ⁿ mark on word capsules. Zero = never recalled.
  const recallCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const w of lessonWords) {
      const info = masteryMap[wordKey(w)]
      m[wordKey(w)] = info?.reviewHistory?.filter((r) => r.source === 'recall').length ?? 0
    }
    return m
  }, [lessonWords, masteryMap])

  const renderQuizFooter = useCallback(
    (paragraphIndex: number) => {
      if (!passage) return null
      return (
        <ParagraphRecallQuiz
          paragraphText={passage.paragraphs[paragraphIndex]}
          lessonWords={lessonWords}
          masteryMap={masteryMap}
          paragraphKey={`${passage.key}-${paragraphIndex}`}
          onAnswer={handleRecallAnswer}
          recallCounts={recallCounts}
        />
      )
    },
    [passage, lessonWords, masteryMap, handleRecallAnswer, recallCounts],
  )

  if (!passage) {
    return (
      <main className="font-nunito relative z-[1] mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mb-3 text-4xl">📭</div>
        <h2 className="mb-2 text-xl font-bold text-[var(--wm-text)]">课文不存在</h2>
        <p className="mb-6 text-[var(--wm-text-dim)]">
          所请求的课文 <code>{key}</code> 还没有内容。
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {readingPassages.map((p) => (
            <Link
              key={p.key}
              href={`/english/words/reading/${p.key}`}
              className="rounded-full bg-[var(--wm-surface)] px-4 py-2 text-sm font-bold text-[var(--wm-text)] ring-1 ring-[var(--wm-border)] transition hover:bg-[var(--wm-surface2)]"
            >
              {p.unit} · {p.lesson}
            </Link>
          ))}
        </div>
      </main>
    )
  }

  const renderLessonAudioButton = (slot: 'words' | 'recitation', label: string, size: '2' | '3') => {
    if (!slots.includes(key + '#' + slot)) return null
    const url = lessonAudioUrl(key, slot)
    const active = player.current?.url === url && player.isPlaying
    const playing = active && !player.isPaused
    const actionLabel = (playing ? '暂停' : '播放') + label
    return (
      <Button
        type="button"
        aria-label={actionLabel}
        aria-pressed={playing}
        onClick={async () => {
          setListening(null)
          setNarrationError('')
          setLoadingNarration(false)
          if (active) return player.togglePause()
          try {
            await player.playWhenReady({
              url,
              label: passage.title + ' · ' + label,
              refLink: '/english/words/reading/' + key,
              mediaType: 'audio',
              source: null,
            })
          } catch {
            setNarrationError('网盘音频暂时无法播放，请重试。')
          }
        }}
        variant="outline"
        color="orange"
        size={size}
      >
        {slot === 'words' && <LearningIcon name={playing ? 'pause' : 'readAloud'} />}
        {slot === 'words' ? '单词' : actionLabel}
      </Button>
    )
  }

  return (
    <main
      className="font-nunito relative z-[1] mx-auto w-full max-w-[1280px] px-3 pt-6 pb-32 md:px-4"
      style={{ colorScheme: 'light' }}
    >
      {/* 全屏深色背景 —— iPhone Safari 深色模式下,某些浏览器版本会因为
          colorScheme: light 把父布局的 var(--wm-bg) 渲染异常;这里显式贴一层
          原色,白色阅读卡在深底上对比更突出。 */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      {/* Page header */}
      <Theme appearance="light" hasBackground={false} className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-orange-200/60 sm:p-5">
        {/* Row 1 — 导航条:返回 ⇆ 模式切换。永远单行,模式 toggle 用短文案 + nowrap */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href="/english/words/reading"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200 transition hover:-translate-x-0.5 hover:bg-white"
            aria-label="返回阅读列表"
          >
            <span className="text-[14px] leading-none">←</span>
            <span>返回</span>
          </Link>
          <SegmentedControl.Root
            aria-label="阅读模式"
            size="2"
            radius="full"
            value={readingMode}
            onValueChange={(mode) => {
              if (mode === 'learn' || mode === 'focus') setReadingMode(mode)
            }}
          >
            <SegmentedControl.Item value="learn" aria-label="学习模式" title="段落末出现遮词回想题，掌握度会更新">
              <Flex as="span" align="center" justify="center" gap="1">
                <LearningIcon name="learn" />
                学习
              </Flex>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="focus" aria-label="专注阅读模式" title="只显示词高亮，纯阅读不打断">
              <Flex as="span" align="center" justify="center" gap="1">
                <LearningIcon name="focus" />
                专注
              </Flex>
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>

        {/* Row 2 — 信息+工具:Lesson 标识 + 前测/难点词芯片,允许自然换行 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-orange-700 ring-1 ring-orange-200">
            📖 {passage.unit} · {passage.lesson}
          </div>
          <Button
            onClick={() => setPreReadingOpen((v) => !v)}
            title="阅读前测 · 测一下全部词"
            aria-label="阅读前测"
            aria-pressed={preReadingOpen}
            variant={preReadingOpen ? 'solid' : 'outline'}
            color={preReadingOpen ? 'sky' : 'orange'}
            size="1"
          >
            <span className="text-[13px] leading-none">📋</span>
            <span>预习</span>
          </Button>
          {passage.glossary && passage.glossary.length > 0 && (
            <Button
              onClick={() => setGlossaryOpen((v) => !v)}
              title="难点词 · 阅读辅助查词"
              aria-label="难点词"
              aria-pressed={glossaryOpen}
              variant={glossaryOpen ? 'solid' : 'outline'}
              color={glossaryOpen ? 'gray' : 'orange'}
              size="1"
            >
              <span className="text-[13px] leading-none">📒</span>
              <span>难点词</span>
              <span
                className={`ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-extrabold ${
                  glossaryOpen
                    ? 'bg-white/25 text-white'
                    : 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
                }`}
              >
                {passage.glossary.length}
              </span>
            </Button>
          )}
        </div>

        <h1 className="font-fredoka text-2xl font-bold text-gray-900 sm:text-3xl">
          <span
            data-narration-cue="title"
            className={target === 'title' ? 'rounded bg-amber-100 text-[1.08em]' : undefined}
          >
            {passage.title}
          </span>
          <span className="ml-2 inline-flex items-center align-middle empty:hidden">
            {clipButton('title')}
          </span>
        </h1>
        <div className="mt-3 flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-gray-600">
            {LEGEND.map((l) => (
              <div key={l.level} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${l.dot}`} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            {clips.length > 0 && (
              <Button
                onClick={() => selectClip(clipIndex, true)}
                variant="outline"
                color="orange"
                size="2"
              >
                <LearningIcon name="listen" />
                听记
              </Button>
            )}
            <Button
              type="button"
              onClick={() => window.open(`/english/words/reading/${passage.key}/print`, '_blank')}
              title="打开适合打印的课文版"
              variant="outline"
              color="gray"
              size="2"
            >
              <LearningIcon name="print" />
              打印
            </Button>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={loadingNarration}
                aria-busy={loadingNarration}
                aria-label={
                  loadingNarration
                    ? '正在加载朗读'
                    : !audioUrl
                      ? '暂无朗读音频'
                      : narrationPlaying
                        ? '暂停朗读'
                        : '播放朗读'
                }
                aria-pressed={narrationPlaying}
                title={
                  !audioUrl ? '暂无朗读音频' : narrationPlaying ? '暂停朗读' : '使用底部播放器朗读'
                }
                onClick={async () => {
                  setListening(null)
                  setNarrationError('')
                  if (!audioUrl) {
                    window.alert('未找到本课朗读音频')
                    return
                  }
                  if (narrationActive && player.isPlaying) {
                    player.togglePause()
                  } else {
                    setLoadingNarration(true)
                    try {
                      const started = await player.playWhenReady({
                        url: audioUrl,
                        label: passage.title,
                        refLink: `/english/words/reading/${key}`,
                        mediaType: 'audio',
                        source: null,
                      })
                      if (started) setLoadingNarration(false)
                    } catch {
                      const networkError =
                        player.audioRef.current?.error?.code === 2 || !navigator.onLine
                      stop()
                      setLoadingNarration(false)
                      setNarrationError(
                        networkError ? '网络连接失败，请重试。' : '音频暂时无法播放，请重试。',
                      )
                    }
                  }
                }}
                variant={narrationPlaying ? 'solid' : 'outline'}
                color="orange"
                size="2"
                loading={loadingNarration}
              >
                <LearningIcon name={narrationPlaying ? 'pause' : 'readAloud'} />
                {narrationPlaying ? '暂停朗读' : '朗读'}
              </Button>
              {renderLessonAudioButton('words', '全部单词音频', '2')}
            </div>
            <label className="ml-auto inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-gray-700">
              <Switch checked={lessonFocus} onCheckedChange={setLessonFocus} color="orange" />
              只看本课词
            </label>
          </div>
        </div>
      </Theme>

      {renderLessonAudioButton('recitation', '背诵音频', '3')}
      {(playbackError || narrationError || (/^(4a|5a)-/.test(key) && baiduError)) && (
        <p role="alert" className="my-3 text-sm text-red-700">
          {playbackError || narrationError || baiduError}
        </p>
      )}

      {/* 阅读前测 · 由标题卡内「📋 前测」芯片触发,关闭后页面回归纯粹 */}
      <PreReadingRecall
        open={preReadingOpen}
        onClose={() => setPreReadingOpen(false)}
        passage={passage}
        lessonWords={lessonWords}
        masteryMap={masteryMap}
        recallCounts={recallCounts}
        onAnswer={handleRecallAnswer}
        onWordClick={setStripSelected}
      />

      {/* 难点词面板 · 由标题卡内「📒 难点词」芯片触发,字典式查询 */}
      <GlossaryPanel
        open={glossaryOpen}
        onClose={() => setGlossaryOpen(false)}
        glossary={passage.glossary ?? []}
      />

      {/* Passage body */}
      <Theme appearance="light" hasBackground={false} className="ring-kid-line rounded-2xl bg-white p-5 ring-1 sm:p-7">
        <PassageView
          passage={passage}
          lessonWords={visibleWords}
          masteryMap={masteryMap}
          focusWord={focusWord}
          listeningTarget={target}
          listeningCollapsed={!listeningOpen || listeningCollapsed}
          renderClipButton={clips.length ? clipButton : undefined}
          narrationRef={
            narrationActive && !listeningOpen && (listening?.key !== key || narrationPlaying)
              ? player.audioRef
              : undefined
          }
          recallOutcomes={recallOutcomes}
          recallCounts={recallCounts}
          mode={readingMode}
          renderParagraphFooter={readingMode === 'learn' ? renderQuizFooter : undefined}
        />
      </Theme>

      {/* 补考区:列出本课还没被段落回想题考过的词,可选完成 */}
      {readingMode === 'learn' && lessonWords.length > 0 && (
        <UncoveredWordsReview
          passage={passage}
          lessonWords={lessonWords}
          recallCounts={recallCounts}
          onAnswer={handleRecallAnswer}
        />
      )}

      {passage.learningSections && passage.learningSections.length > 0 && (
        <DarkScope appearance="light">
          <ReadingLearningSections
            key={readingMode}
            sections={passage.learningSections}
            vocab={fullVocab}
            defaultOpen={readingMode === 'learn'}
            onWordClick={setStripSelected}
          />
        </DarkScope>
      )}

      <WordPopup
        entry={stripSelected}
        entries={lessonWords}
        passage={passage}
        mastery={stripSelected ? masteryMap[wordKey(stripSelected)] : undefined}
        onEntryChange={setStripSelected}
        onClose={() => setStripSelected(null)}
      />
      <div hidden={listeningOpen || (listeningActive && !listeningPaused)}>
        <PlayerDock player={player} theme="light" showProgress />
      </div>
      {listeningActive && clips[clipIndex] && (
        <DarkScope appearance="light">
          <ListeningDrawer
            panelOpen={listeningOpen}
            passageKey={key}
            clips={clips}
            index={clipIndex}
            replayRequest={clipReplayRequest}
            onLoadingClipChange={setLoadingClipIndex}
            select={showClip}
            close={closeListening}
            collapsed={listeningCollapsed}
            setCollapsed={setListeningCollapsed}
            paused={listeningPaused}
            setPaused={setListeningPaused}
            selected={selectedClips}
            setSelected={setSelectedClips}
          />
        </DarkScope>
      )}
    </main>
  )
}
