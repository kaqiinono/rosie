'use client'

import { use, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useWordsContext } from '@/contexts/WordsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { findPassageByKey, findSentenceForWord, readingPassages } from '@/utils/reading-data'
import { wordKey } from '@/utils/english-helpers'
import { getWordMasteryLevel, type MasteryLevel } from '@/utils/masteryUtils'
import { todayStr } from '@/utils/constant'
import type { WordEntry, WeekDayProgress } from '@/utils/type'
import PassageView from '@/components/english/reading/PassageView'
import WordPopup from '@/components/english/reading/WordPopup'
import ParagraphRecallQuiz from '@/components/english/reading/ParagraphRecallQuiz'

const LEGEND: { level: MasteryLevel; label: string; dot: string }[] = [
  { level: 0, label: '未掌握', dot: 'bg-amber-400' },
  { level: 1, label: '学习中', dot: 'bg-sky-400' },
  { level: 2, label: '熟悉', dot: 'bg-violet-400' },
  { level: 3, label: '已掌握', dot: 'bg-emerald-400' },
]

const STRIP_PILL: Record<MasteryLevel, string> = {
  0: 'bg-amber-50 text-amber-900 ring-amber-300',
  1: 'bg-sky-50 text-sky-900 ring-sky-300',
  2: 'bg-violet-50 text-violet-900 ring-violet-300',
  3: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
}

const STRIP_DOT: Record<MasteryLevel, string> = {
  0: 'bg-amber-400',
  1: 'bg-sky-400',
  2: 'bg-violet-400',
  3: 'bg-emerald-400',
}

export default function ReadingPassagePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)
  const { vocab, masteryMap, recordBatch } = useWordsContext()
  const { user } = useAuth()
  const { weeklyPlan, updateDayProgress } = useWeeklyPlan(user)
  const searchParams = useSearchParams()
  const focusWord = searchParams.get('focus')

  const passage = findPassageByKey(key)
  const [stripSelected, setStripSelected] = useState<WordEntry | null>(null)
  /** Two reading modes per design 2C. Defaults to 学习模式 (with recall quizzes). */
  const [readingMode, setReadingMode] = useState<'focus' | 'learn'>('learn')

  // Mark the daily 读课文 step complete once the learner has scrolled past 50%
  // of the passage. Guarded so we only write once per page mount.
  const readingMarkedRef = useRef(false)
  const isFocusPassage =
    !!passage &&
    !!weeklyPlan?.focusLessonKey &&
    weeklyPlan.focusLessonKey === `${passage.unit}::${passage.lesson}`
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
      if (correct) recordBatch([{ entry, correct: true }])
    },
    [recordBatch],
  )

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
        />
      )
    },
    [passage, lessonWords, masteryMap, handleRecallAnswer],
  )

  if (!passage) {
    return (
      <main className="font-nunito relative z-[1] mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mb-3 text-4xl">📭</div>
        <h2 className="mb-2 text-xl font-bold text-[var(--wm-text)]">课文不存在</h2>
        <p className="mb-6 text-[var(--wm-text-dim)]">所请求的课文 <code>{key}</code> 还没有内容。</p>
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
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-5 ring-1 ring-orange-200/60">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href="/english/words/reading"
              className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200 transition hover:-translate-x-0.5 hover:bg-white"
              aria-label="返回阅读列表"
            >
              <span className="text-[14px] leading-none">←</span>
              <span>返回</span>
            </Link>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-orange-700 ring-1 ring-orange-200">
              📖 {passage.unit} · {passage.lesson}
            </div>
          </div>
          {/* Mode toggle (2C) */}
          <div className="inline-flex rounded-full bg-white/70 p-0.5 ring-1 ring-orange-200">
            {(['learn', 'focus'] as const).map((m) => {
              const active = readingMode === m
              return (
                <button
                  key={m}
                  onClick={() => setReadingMode(m)}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-extrabold transition ${
                    active
                      ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow-sm'
                      : 'text-orange-700/70 hover:text-orange-800'
                  }`}
                  title={m === 'learn' ? '段落末出现遮词回想题，掌握度会更新' : '只显示词高亮，纯阅读不打断'}
                >
                  {m === 'learn' ? '🧠 学习模式' : '📖 专注阅读'}
                </button>
              )
            })}
          </div>
        </div>
        <h1 className="font-fredoka text-2xl font-bold text-gray-900 sm:text-3xl">{passage.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-gray-600">
          {LEGEND.map((l) => (
            <div key={l.level} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${l.dot}`} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Passage body */}
      <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:p-7">
        <PassageView
          passage={passage}
          lessonWords={lessonWords}
          masteryMap={masteryMap}
          focusWord={focusWord}
          recallOutcomes={recallOutcomes}
          renderParagraphFooter={readingMode === 'learn' ? renderQuizFooter : undefined}
        />
      </div>

      {/* Bottom word strip */}
      {lessonWords.length > 0 && (
        <div className="mt-6 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">本课词汇 · {lessonWords.length}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lessonWords.map((w) => {
              const level = getWordMasteryLevel(masteryMap[wordKey(w)]?.correct ?? 0)
              return (
                <button
                  key={wordKey(w)}
                  onClick={() => setStripSelected(w)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 transition hover:-translate-y-px ${STRIP_PILL[level]}`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${STRIP_DOT[level]}`} />
                  {w.word}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 3C: 沉浸模式语境版入口 — 读完课文后开始 Type D 沉浸练习 */}
      {lessonWords.some(w => {
        const p = passage
        return p && findSentenceForWord(p, w.word) !== null
      }) && (
        <Link
          href={`/english/words/practice?context=${passage.key}`}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-4 text-white shadow-[0_4px_14px_rgba(245,158,11,.35)] no-underline transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(245,158,11,.5)]"
        >
          <span className="text-[20px]">🧠</span>
          <div className="text-center">
            <div className="text-[15px] font-extrabold leading-tight">开始语境练习</div>
            <div className="text-[11px] font-medium opacity-90 mt-0.5">用本课课文原句挖空，检验你的语境理解</div>
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
