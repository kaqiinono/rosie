'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan'
import { useMathWeeklyPlan } from '@/hooks/useMathWeeklyPlan'
import { useWordData } from '@/hooks/useWordData'
import { useCalcDaily } from '@/hooks/useCalcDaily'
import { todayStr } from '@/utils/constant'
import { findPassage, parseFocusLessonKey } from '@/utils/reading-data'
import type { WordEntry } from '@/utils/type'

function wordKeyStr(e: WordEntry): string {
  return `${e.unit}::${e.lesson}::${e.word}`
}

const SECTION_LABELS: Record<string, string> = {
  lesson: '课堂',
  homework: '课后',
  workbook: '练习册',
  pretest: '课前测',
}

const SECTION_COLORS: Record<string, string> = {
  lesson: '#f97316',
  homework: '#8b5cf6',
  workbook: '#0d9488',
  pretest: '#ec4899',
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-20 w-20 rounded-full opacity-20"
          style={{
            background: 'conic-gradient(from 0deg, #f97316, #fbbf24, #10b981, #6366f1, #f97316)',
            animation: 'spin 2s linear infinite',
          }}
        />
        <div className="flex gap-1">
          {['⭐', '📖', '📐'].map((e, i) => (
            <span
              key={i}
              className="text-2xl"
              style={{
                animation: 'bounce-slow 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
                display: 'inline-block',
              }}
            >
              {e}
            </span>
          ))}
        </div>
      </div>
      <div className="text-[13px] font-semibold text-text-muted tracking-wide">正在加载今日计划…</div>
    </div>
  )
}

interface WordCardProps {
  entry: WordEntry
  isNew: boolean
}

function WordCard({ entry, isNew }: WordCardProps) {
  return (
    <div
      className="relative shrink-0 w-[200px] rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(99,102,241,.3)',
        boxShadow: '0 8px 24px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.06)',
      }}
    >
      {/* Glow accent */}
      <div
        className="absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl opacity-30"
        style={{ background: isNew ? '#6366f1' : '#10b981' }}
      />

      {/* Badge */}
      <div className="relative px-4 pt-3 pb-2">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{
            background: isNew ? 'rgba(99,102,241,.2)' : 'rgba(16,185,129,.2)',
            color: isNew ? '#a5b4fc' : '#6ee7b7',
            border: `1px solid ${isNew ? 'rgba(99,102,241,.3)' : 'rgba(16,185,129,.3)'}`,
          }}
        >
          {isNew ? '新词' : '复习'}
        </span>
      </div>

      {/* Word */}
      <div className="px-4 pb-1">
        <div
          className="text-[22px] font-black leading-tight tracking-tight"
          style={{ color: '#f1f5f9', fontFamily: '"Nunito", sans-serif' }}
        >
          {entry.word}
        </div>
        {entry.ipa && (
          <div className="text-[11px] font-medium mt-0.5" style={{ color: '#94a3b8' }}>
            {entry.ipa}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 my-2 h-px" style={{ background: 'rgba(255,255,255,.07)' }} />

      {/* Explanation */}
      <div className="px-4 pb-2">
        <div className="text-[12px] font-bold leading-snug" style={{ color: '#cbd5e1' }}>
          {entry.explanation}
        </div>
      </div>

      {/* Example */}
      {entry.example && (
        <div
          className="mx-3 mb-3 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <div className="text-[10px] leading-relaxed italic" style={{ color: '#64748b' }}>
            {entry.example}
          </div>
        </div>
      )}
    </div>
  )
}

interface ThreeStepRowProps {
  index: number
  done: boolean
  /** When true, render in a muted state — used to hint "complete the previous step first". */
  pendingDimmed?: boolean
  icon: string
  title: string
  subtitle?: string
  /** Optional helper text shown below the subtitle in lighter weight. */
  hint?: string
  href: string
  color: 'orange' | 'blue' | 'purple'
}

function ThreeStepRow({ index, done, pendingDimmed, icon, title, subtitle, hint, href, color }: ThreeStepRowProps) {
  const palette = {
    orange: { bg: 'linear-gradient(135deg,#ffedd5,#fde68a)', border: 'rgba(251,146,60,.3)', text: '#c2410c', sub: '#9a3412', dot: 'linear-gradient(135deg,#f97316,#fbbf24)' },
    blue:   { bg: 'linear-gradient(135deg,#dbeafe,#e0f2fe)', border: 'rgba(59,130,246,.28)', text: '#1d4ed8', sub: '#1e3a8a', dot: 'linear-gradient(135deg,#3b82f6,#60a5fa)' },
    purple: { bg: 'linear-gradient(135deg,#ede9fe,#f5d0fe)', border: 'rgba(168,85,247,.28)', text: '#7c3aed', sub: '#5b21b6', dot: 'linear-gradient(135deg,#a855f7,#c084fc)' },
  }[color]

  const greenBg = 'linear-gradient(135deg,#dcfce7,#bbf7d0)'
  const greenBorder = 'rgba(34,197,94,.3)'

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 no-underline transition-all hover:-translate-y-0.5 ${pendingDimmed ? 'opacity-80' : ''}`}
      style={{
        background: done ? greenBg : palette.bg,
        border: `1.5px solid ${done ? greenBorder : palette.border}`,
        boxShadow: done ? '0 4px 16px rgba(34,197,94,.1)' : '0 4px 16px rgba(0,0,0,.04)',
      }}
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[20px] text-white"
        style={{ background: done ? 'linear-gradient(135deg,#22c55e,#4ade80)' : palette.dot }}
      >
        {done ? '✓' : icon}
        <span
          className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ background: done ? '#16a34a' : '#1f2937' }}
        >
          {index}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] font-extrabold leading-tight"
          style={{ color: done ? '#166534' : palette.text }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] font-medium mt-0.5 truncate" style={{ color: done ? '#16a34a' : palette.sub }}>
            {subtitle}
          </div>
        )}
        {hint && (
          <div className="text-[10px] mt-0.5" style={{ color: done ? '#16a34a' : '#a16207' }}>
            💡 {hint}
          </div>
        )}
      </div>
      <span className="text-[14px] font-extrabold" style={{ color: done ? '#16a34a' : palette.text }}>
        →
      </span>
    </Link>
  )
}

export default function TodayDashboard() {
  const { user } = useAuth()
  const { weeklyPlan: englishPlan, isLoading: englishLoading } = useWeeklyPlan(user)
  const { weeklyPlan: mathPlan, isLoading: mathLoading } = useMathWeeklyPlan(user)
  const { vocab } = useWordData(user)
  const calcDaily = useCalcDaily(user)

  const today = todayStr()

  // English: today's word keys -> full WordEntry objects
  const englishToday = englishPlan?.days.find(d => d.date === today)
  const englishProgress = englishPlan?.progress[today]
  const newWordKeys = englishToday?.newWordKeys ?? []
  const vocabByKey = Object.fromEntries(vocab.map(w => [wordKeyStr(w), w]))
  const todayWords = newWordKeys.map(k => vocabByKey[k]).filter(Boolean) as WordEntry[]
  const englishDone = !!englishProgress?.quizDone

  // Reading prompt (Stage 1 of three-stage loop): surfaces when *any* of
  // today's new-word lessons has a passage available. If the week-plan has a
  // ⭐ focus lesson, prefer that passage; otherwise pick the lesson contributing
  // the most words today.
  const readingDoneToday = !!englishProgress?.readingDone

  const suggestedPassage = (() => {
    if (!todayWords.length) return null
    const focusKey = englishPlan?.focusLessonKey
    // Prefer the ⭐ focus lesson if today's words include it AND it has a passage
    if (focusKey) {
      const parsed = parseFocusLessonKey(focusKey)
      if (parsed) {
        const focusP = findPassage(parsed.stage, parsed.unit, parsed.lesson)
        if (focusP && todayWords.some(w => w.unit === focusP.unit && w.lesson === focusP.lesson)) {
          return focusP
        }
      }
    }
    // Otherwise pick the lesson contributing the most words today that has a passage
    const counts = new Map<string, { stage?: string; unit: string; lesson: string; n: number }>()
    for (const w of todayWords) {
      const k = `${w.stage ?? ''}::${w.unit}::${w.lesson}`
      const cur = counts.get(k)
      if (cur) cur.n += 1
      else counts.set(k, { stage: w.stage, unit: w.unit, lesson: w.lesson, n: 1 })
    }
    const sorted = [...counts.values()].sort((a, b) => b.n - a.n)
    for (const c of sorted) {
      const p = findPassage(c.stage, c.unit, c.lesson)
      if (p) return p
    }
    return null
  })()
  const todayHasFocusWords = !!suggestedPassage

  // Split today's words into consolidate vs preview using wordKinds (the plan's
  // per-word classification). Drives the ②③ counts in the three-step layout.
  const wordKinds = englishPlan?.wordKinds ?? {}
  const consolidateNewCount = newWordKeys.filter(k => (wordKinds[k] ?? 'consolidate') === 'consolidate').length
  const previewNewCount = newWordKeys.filter(k => wordKinds[k] === 'preview').length
  const consolidateDone = !!englishProgress?.consolidateDone
  const previewDone = !!englishProgress?.previewDone

  // Math: today's required problems
  const mathToday = mathPlan?.days.find(d => d.date === today)
  const mathProgress = mathPlan?.progress[today] ?? { doneKeys: [] }
  const mathProblems = mathToday?.problems ?? []
  const mathDoneCount = mathProblems.filter(p => mathProgress.doneKeys.includes(p.key)).length
  const mathAllDone = mathProblems.length > 0 && mathDoneCount >= mathProblems.length

  const isLoading = englishLoading || mathLoading

  if (isLoading) return <LoadingState />

  const hasMath = mathPlan && mathProblems.length > 0
  const hasEnglish = englishPlan && newWordKeys.length > 0
  const calcDoneCount = calcDaily.todayDone
  const calcTargetCount = calcDaily.todayTarget
  const calcAllDone = calcDoneCount >= calcTargetCount && calcTargetCount > 0
  const calcAccuracy = calcDoneCount > 0 ? Math.round((calcDaily.todayCorrect / calcDoneCount) * 100) : 0

  return (
    <div className="mx-auto max-w-[640px] px-4 pb-12">

      {/* Stats cards row */}
      {(hasMath || hasEnglish) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {/* Math card */}
          <div
            className="rounded-2xl px-4 py-3.5 relative overflow-hidden"
            style={{
              background: mathAllDone
                ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                : 'linear-gradient(135deg, #fff7ed, #fef3c7)',
              border: `1.5px solid ${mathAllDone ? 'rgba(34,197,94,.3)' : 'rgba(251,146,60,.25)'}`,
              boxShadow: mathAllDone ? '0 4px 16px rgba(34,197,94,.12)' : '0 4px 16px rgba(251,146,60,.1)',
            }}
          >
            <div className="absolute -right-2 -top-2 text-3xl opacity-15">📐</div>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: mathAllDone ? '#16a34a' : '#c2410c' }}>
              数学
            </div>
            <div className="text-[26px] font-black leading-none" style={{ color: mathAllDone ? '#15803d' : '#ea580c' }}>
              {mathDoneCount}<span className="text-[16px] font-semibold opacity-60">/{mathProblems.length}</span>
            </div>
            <div className="text-[10px] mt-1 font-medium" style={{ color: mathAllDone ? '#16a34a' : '#9a3412' }}>
              {mathAllDone ? '全部完成 🎉' : `还剩 ${mathProblems.length - mathDoneCount} 题`}
            </div>
            {/* progress bar */}
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${mathProblems.length > 0 ? (mathDoneCount / mathProblems.length) * 100 : 0}%`,
                  background: mathAllDone ? '#22c55e' : '#f97316',
                }}
              />
            </div>
          </div>

          {/* English card */}
          <div
            className="rounded-2xl px-4 py-3.5 relative overflow-hidden"
            style={{
              background: englishDone
                ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                : 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
              border: `1.5px solid ${englishDone ? 'rgba(34,197,94,.3)' : 'rgba(16,185,129,.2)'}`,
              boxShadow: englishDone ? '0 4px 16px rgba(34,197,94,.12)' : '0 4px 16px rgba(16,185,129,.08)',
            }}
          >
            <div className="absolute -right-2 -top-2 text-3xl opacity-15">📖</div>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: englishDone ? '#16a34a' : '#0f766e' }}>
              英语
            </div>
            <div className="text-[26px] font-black leading-none" style={{ color: englishDone ? '#15803d' : '#0d9488' }}>
              {englishDone ? todayWords.length : 0}<span className="text-[16px] font-semibold opacity-60">/{todayWords.length}</span>
            </div>
            <div className="text-[10px] mt-1 font-medium" style={{ color: englishDone ? '#16a34a' : '#115e59' }}>
              {englishDone ? `得分 ${englishProgress?.lastScore ?? 0}% 🎉` : `${todayWords.length} 个新词待学`}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: englishDone ? '100%' : '0%',
                  background: '#10b981',
                }}
              />
            </div>
          </div>

          {/* Calc card */}
          <div
            className="rounded-2xl px-4 py-3.5 relative overflow-hidden"
            style={{
              background: calcAllDone
                ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                : 'linear-gradient(135deg, #f3e8ff, #fae8ff)',
              border: `1.5px solid ${calcAllDone ? 'rgba(34,197,94,.3)' : 'rgba(139,92,246,.25)'}`,
              boxShadow: calcAllDone ? '0 4px 16px rgba(34,197,94,.12)' : '0 4px 16px rgba(139,92,246,.1)',
            }}
          >
            <div className="absolute -right-2 -top-2 text-3xl opacity-15">🧮</div>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: calcAllDone ? '#16a34a' : '#7c3aed' }}>
              口算
            </div>
            <div className="text-[26px] font-black leading-none" style={{ color: calcAllDone ? '#15803d' : '#8b5cf6' }}>
              {calcDoneCount}<span className="text-[16px] font-semibold opacity-60">/{calcTargetCount}</span>
            </div>
            <div className="text-[10px] mt-1 font-medium" style={{ color: calcAllDone ? '#16a34a' : '#6d28d9' }}>
              {calcAllDone ? `🎉 完成 · 得 ${calcDaily.todayCoins}⭐` : (calcDoneCount > 0 ? `正确率 ${calcAccuracy}%` : '今日还未练习')}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${calcTargetCount > 0 ? Math.min(100, (calcDoneCount / calcTargetCount) * 100) : 0}%`,
                  background: calcAllDone ? '#22c55e' : '#8b5cf6',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* English section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold flex items-center gap-2 text-text-primary">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm bg-gradient-to-br from-teal-600 to-emerald-500 shadow-[0_3px_10px_rgba(13,148,136,.3)]">
              📖
            </span>
            英语单词预习
          </h2>
          {englishPlan?.id && (
            <Link
              href={`/english/words/weekly/${englishPlan.id}`}
              className="text-[12px] font-bold no-underline flex items-center gap-1 transition-opacity hover:opacity-70 text-teal-700"
            >
              前往练习 →
            </Link>
          )}
        </div>

        {hasEnglish ? (
          <>
            {/* Three-step task flow ①②③ (design 1A + 计划页三步式) */}
            <div className="mb-3 space-y-2">
              {todayHasFocusWords && suggestedPassage && (
                <ThreeStepRow
                  index={1}
                  done={readingDoneToday}
                  pendingDimmed={false}
                  icon="📖"
                  title="读课文"
                  subtitle={readingDoneToday ? `已读 · ${suggestedPassage.title}` : `建议先读 · ${suggestedPassage.title}`}
                  hint={readingDoneToday ? undefined : '先建立语境记忆，再练习效果更好'}
                  href={`/english/words/reading/${suggestedPassage.key}?from=today`}
                  color="orange"
                />
              )}
              {consolidateNewCount > 0 && englishPlan?.id && (
                <ThreeStepRow
                  index={todayHasFocusWords ? 2 : 1}
                  done={consolidateDone}
                  pendingDimmed={todayHasFocusWords && !readingDoneToday && !consolidateDone}
                  icon="🆕"
                  title={`必记词练习 ${consolidateNewCount} 个`}
                  subtitle={consolidateDone ? `已完成${englishProgress?.consolidateScore !== undefined ? ` · ${englishProgress.consolidateScore}%` : ''}` : '今日新增的必记单词'}
                  hint={todayHasFocusWords && !readingDoneToday && !consolidateDone ? '建议先读课文' : undefined}
                  href={`/english/words/weekly/${englishPlan.id}`}
                  color="blue"
                />
              )}
              {previewNewCount > 0 && englishPlan?.id && (
                <ThreeStepRow
                  index={
                    (todayHasFocusWords ? 1 : 0) + (consolidateNewCount > 0 ? 1 : 0) + 1
                  }
                  done={previewDone}
                  pendingDimmed={false}
                  icon="🔖"
                  title={`预习词练习 ${previewNewCount} 个`}
                  subtitle={previewDone ? `已完成${englishProgress?.previewScore !== undefined ? ` · ${englishProgress.previewScore}%` : ''}` : '提前接触下周内容'}
                  href={`/english/words/weekly/${englishPlan.id}`}
                  color="purple"
                />
              )}
            </div>

            {todayWords.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none -mx-4 px-4">
                {todayWords.map((word) => (
                  <WordCard key={`${word.unit}::${word.lesson}::${word.word}`} entry={word} isNew={true} />
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-text-muted py-3">今日暂无新词</div>
            )}

            {englishDone && (
              <div
                className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', border: '1px solid rgba(34,197,94,.2)' }}
              >
                <span className="text-lg">🎉</span>
                <span className="text-[12px] font-bold text-green-700">今日英语已完成，得分 {englishProgress?.lastScore ?? 0}%</span>
              </div>
            )}
          </>
        ) : (
          <div
            className="rounded-2xl border-2 border-dashed px-5 py-6 text-center"
            style={{ borderColor: 'rgba(13,148,136,.2)', background: 'rgba(240,253,250,.5)' }}
          >
            <div className="text-3xl mb-2">📖</div>
            <div className="text-[13px] text-text-muted mb-3">还没有本周英语计划</div>
            <Link
              href="/english/words/daily"
              className="inline-block rounded-xl px-4 py-2 text-[13px] font-bold text-white no-underline transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #0d9488, #10b981)', boxShadow: '0 4px 12px rgba(13,148,136,.3)' }}
            >
              创建英语计划
            </Link>
          </div>
        )}
      </section>

      {/* Calc section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold flex items-center gap-2 text-text-primary">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_3px_10px_rgba(139,92,246,.3)]">
              🧮
            </span>
            今日口算挑战
          </h2>
          <Link
            href={`/calc?count=${calcTargetCount}`}
            className="text-[12px] font-bold no-underline flex items-center gap-1 transition-opacity hover:opacity-70 text-violet-600"
          >
            {calcAllDone ? '再练一组 →' : '前往练习 →'}
          </Link>
        </div>

        <div
          className="rounded-2xl px-4 py-4"
          style={{
            background: calcAllDone
              ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
              : 'linear-gradient(135deg, #f5f3ff, #fae8ff)',
            border: `1.5px solid ${calcAllDone ? 'rgba(34,197,94,.25)' : 'rgba(139,92,246,.2)'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
              style={{
                background: calcAllDone
                  ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                  : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                color: 'white',
                boxShadow: calcAllDone
                  ? '0 3px 10px rgba(34,197,94,.3)'
                  : '0 3px 10px rgba(139,92,246,.3)',
              }}
            >
              {calcAllDone ? '✓' : '🧮'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-extrabold" style={{ color: calcAllDone ? '#15803d' : '#6d28d9' }}>
                {calcAllDone
                  ? `今日完成 ${calcDoneCount} 题`
                  : `进度 ${calcDoneCount} / ${calcTargetCount}`}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: calcAllDone ? '#16a34a' : '#7c3aed' }}>
                {calcDoneCount > 0
                  ? `正确率 ${calcAccuracy}% · 已得 ⭐ ${calcDaily.todayCoins}`
                  : '加减乘除闯关，答对得星星兑换奖券'}
              </div>
            </div>
            {calcAllDone && <span className="text-2xl">🎉</span>}
          </div>
        </div>
      </section>

      {/* Math section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold flex items-center gap-2 text-text-primary">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_3px_10px_rgba(249,115,22,.3)]">
              📐
            </span>
            今日数学题目
          </h2>
          <Link
            href="/math/ny/plan"
            className="text-[12px] font-bold no-underline flex items-center gap-1 transition-opacity hover:opacity-70 text-orange-600"
          >
            前往做题 →
          </Link>
        </div>

        {hasMath ? (
          <div className="space-y-2">
            {mathProblems.map((prob, i) => {
              const done = mathProgress.doneKeys.includes(prob.key)
              const sectionColor = SECTION_COLORS[prob.section] ?? '#94a3b8'
              return (
                <Link
                  key={prob.key}
                  href={`/math/ny/${prob.lessonId}/${prob.section}/${prob.index}`}
                  className="flex items-center gap-3 rounded-2xl px-3.5 py-3 no-underline transition-all hover:-translate-y-0.5"
                  style={{
                    background: done
                      ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                      : 'linear-gradient(135deg, #ffffff, #fff7ed)',
                    border: `1.5px solid ${done ? 'rgba(34,197,94,.25)' : 'rgba(251,146,60,.2)'}`,
                    boxShadow: done ? '0 2px 8px rgba(34,197,94,.08)' : '0 2px 8px rgba(251,146,60,.06)',
                  }}
                >
                  {/* Status circle */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-black"
                    style={{
                      background: done
                        ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                        : 'linear-gradient(135deg, #fff7ed, #fef3c7)',
                      border: done ? 'none' : '1.5px solid rgba(251,146,60,.3)',
                      color: done ? 'white' : '#c2410c',
                      boxShadow: done ? '0 3px 8px rgba(34,197,94,.25)' : 'none',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-semibold truncate leading-tight"
                      style={{ color: done ? '#16a34a' : '#1e293b', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }}
                    >
                      {prob.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="rounded-full px-1.5 py-px text-[9px] font-bold"
                        style={{ background: `${sectionColor}18`, color: sectionColor }}
                      >
                        {SECTION_LABELS[prob.section] ?? prob.section}
                      </span>
                      <span className="text-[10px] text-text-muted">第 {prob.lessonId} 讲</span>
                    </div>
                  </div>

                  <span className="text-[11px]" style={{ color: done ? '#86efac' : '#fca58a' }}>
                    {done ? '✓' : '→'}
                  </span>
                </Link>
              )
            })}

            {mathAllDone && (
              <div
                className="mt-2 rounded-2xl px-4 py-3 text-center"
                style={{
                  background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                  border: '1.5px solid rgba(34,197,94,.25)',
                }}
              >
                <span className="text-[13px] font-extrabold text-green-700">🎉 今天所有数学题都完成啦！</span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl border-2 border-dashed px-5 py-6 text-center"
            style={{ borderColor: 'rgba(251,146,60,.25)', background: 'rgba(255,247,237,.5)' }}
          >
            <div className="text-3xl mb-2">📐</div>
            <div className="text-[13px] text-text-muted mb-3">还没有本周数学计划</div>
            <Link
              href="/math/ny/plan"
              className="inline-block rounded-xl px-4 py-2 text-[13px] font-bold text-white no-underline transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)', boxShadow: '0 4px 12px rgba(249,115,22,.3)' }}
            >
              创建数学计划
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
