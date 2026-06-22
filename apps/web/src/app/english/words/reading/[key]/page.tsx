'use client'

import { use, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWordsContext } from '@/contexts/WordsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { useReadingPassageAudio } from '@/hooks/useReadingPassageAudio'
import ReadingAudioButton from '@/components/english/reading/ReadingAudioButton'
import {
  findPassageByKey,
  findSentenceForWord,
  parseFocusLessonKey,
  readingPassages,
} from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import type { MasteryLevel } from '@/utils/masteryUtils'
import { todayStr } from '@/utils/constant'
import type { WordEntry, WeekDayProgress } from '@/utils/type'
import PassageView from '@/components/english/reading/PassageView'
import WordPopup from '@/components/english/reading/WordPopup'
import ParagraphRecallQuiz from '@/components/english/reading/ParagraphRecallQuiz'
import UncoveredWordsReview from '@/components/english/reading/UncoveredWordsReview'
import PreReadingRecall from '@/components/english/reading/PreReadingRecall'
import GlossaryPanel from '@/components/english/reading/GlossaryPanel'

const LEGEND: { level: MasteryLevel; label: string; dot: string }[] = [
  { level: 0, label: '未掌握', dot: 'bg-amber-400' },
  { level: 1, label: '学习中', dot: 'bg-sky-400' },
  { level: 2, label: '熟悉', dot: 'bg-violet-400' },
  { level: 3, label: '已掌握', dot: 'bg-emerald-400' },
]

export default function ReadingPassagePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  const { vocab, masteryMap, recordRecallAttempt } = useWordsContext()
  const { user } = useAuth()
  const { weeklyPlan, updateDayProgress } = useWeeklyPlan(user)
  const audioUrl = useReadingPassageAudio(user, key)
  const searchParams = useSearchParams()
  const focusWord = searchParams.get('focus')

  const passage = findPassageByKey(key)
  const [stripSelected, setStripSelected] = useState<WordEntry | null>(null)
  /** Two reading modes per design 2C. Defaults to 学习模式 (with recall quizzes). */
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('learn')
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
    return vocab.filter((w) => w.unit === passage.unit && w.lesson === passage.lesson)
  }, [vocab, passage])

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

  return (
    <main
      className="font-nunito relative z-[1] mx-auto max-w-3xl px-4 pt-6 pb-32"
      style={{ colorScheme: 'light' }}
    >
      {/* 全屏深色背景 —— iPhone Safari 深色模式下,某些浏览器版本会因为
          colorScheme: light 把父布局的 var(--wm-bg) 渲染异常;这里显式贴一层
          原色,白色阅读卡在深底上对比更突出。 */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[var(--wm-bg)]" />

      {/* Page header */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 ring-1 ring-orange-200/60 sm:p-5">
        {/* Row 1 — 导航条:返回 ⇆ 模式切换。永远单行,模式 toggle 用短文案 + nowrap */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            href="/english/words/reading"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200 transition hover:-translate-x-0.5 hover:bg-white"
            aria-label="返回阅读列表"
          >
            <span className="text-[14px] leading-none">←</span>
            <span>返回</span>
          </Link>
          <div className="inline-flex shrink-0 rounded-full bg-white/70 p-0.5 ring-1 ring-orange-200">
            {(['learn', 'focus'] as const).map((m) => {
              const active = readingMode === m
              return (
                <button
                  key={m}
                  onClick={() => setReadingMode(m)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap transition ${
                    active
                      ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow-sm'
                      : 'text-orange-700/70 hover:text-orange-800'
                  }`}
                  title={
                    m === 'learn'
                      ? '段落末出现遮词回想题，掌握度会更新'
                      : '只显示词高亮，纯阅读不打断'
                  }
                  aria-label={m === 'learn' ? '学习模式' : '专注阅读模式'}
                >
                  {m === 'learn' ? '🧠 学习' : '📖 专注'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Row 2 — 信息+工具:Lesson 标识 + 前测/难点词芯片,允许自然换行 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-orange-700 ring-1 ring-orange-200">
            📖 {passage.unit} · {passage.lesson}
          </div>
          <button
            onClick={() => setPreReadingOpen((v) => !v)}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:-translate-y-px ${
              preReadingOpen
                ? 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm ring-1 ring-sky-300'
                : 'bg-white/80 text-orange-700 ring-1 ring-orange-200 hover:bg-white'
            }`}
            title="阅读前测 · 测一下全部词"
            aria-label="阅读前测"
            aria-pressed={preReadingOpen}
          >
            <span className="text-[13px] leading-none">📋</span>
            <span>预习</span>
          </button>
          {passage.glossary && passage.glossary.length > 0 && (
            <button
              onClick={() => setGlossaryOpen((v) => !v)}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:-translate-y-px ${
                glossaryOpen
                  ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-sm ring-1 ring-slate-400'
                  : 'bg-white/80 text-orange-700 ring-1 ring-orange-200 hover:bg-white'
              }`}
              title="难点词 · 阅读辅助查词"
              aria-label="难点词"
              aria-pressed={glossaryOpen}
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
            </button>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 font-fredoka text-2xl font-bold text-gray-900 sm:text-3xl">
            {passage.title}
          </h1>
          <ReadingAudioButton
            src={audioUrl}
            mode="once"
            size="md"
            className="mt-0.5"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-gray-600">
          {LEGEND.map((l) => (
            <div key={l.level} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${l.dot}`} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

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
      <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-7">
        <PassageView
          passage={passage}
          lessonWords={lessonWords}
          masteryMap={masteryMap}
          focusWord={focusWord}
          recallOutcomes={recallOutcomes}
          recallCounts={recallCounts}
          mode={readingMode}
          renderParagraphFooter={readingMode === 'learn' ? renderQuizFooter : undefined}
        />
      </div>

      {/* 补考区:列出本课还没被段落回想题考过的词,可选完成 */}
      {readingMode === 'learn' && lessonWords.length > 0 && (
        <UncoveredWordsReview
          passage={passage}
          lessonWords={lessonWords}
          recallCounts={recallCounts}
          onAnswer={handleRecallAnswer}
        />
      )}

      {/* 3C: 沉浸模式语境版入口 — 读完课文后开始 Type D 沉浸练习 */}
      {lessonWords.some((w) => {
        const p = passage
        return p && findSentenceForWord(p, w.word) !== null
      }) && (
        <Link
          href={`/english/words/practice?context=${passage.key}`}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-4 text-white no-underline shadow-[0_4px_14px_rgba(245,158,11,.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(245,158,11,.5)]"
        >
          <span className="text-[20px]">🧠</span>
          <div className="text-center">
            <div className="text-[15px] leading-tight font-extrabold">开始语境练习</div>
            <div className="mt-0.5 text-[11px] font-medium opacity-90">
              用本课课文原句挖空，检验你的语境理解
            </div>
          </div>
          <span className="text-[18px] font-extrabold">→</span>
        </Link>
      )}

      <WordPopup
        entry={stripSelected}
        passage={passage}
        mastery={stripSelected ? masteryMap[wordKey(stripSelected)] : undefined}
        onClose={() => setStripSelected(null)}
      />
    </main>
  )
}
