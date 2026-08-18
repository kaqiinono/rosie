'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import {
  MATH_PLAN_SECTIONS,
  planEndDate,
  planProblemAnswerStatus,
  isPlanProblemDone,
} from '@rosie/math-kit/utils/math-helpers'
import FavoriteHeart from '@rosie/math-kit/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import PracticeViewDraftButton from '@rosie/math/components/shared/practice-queue/PracticeViewDraftButton'
import { resolveMathPlanProblem } from '@rosie/math/utils/practice-queue-from-plan'
import { todayStr } from '@rosie/core'
import { lessonDisplayLabel, lessonDisplayNum } from '@rosie/math-kit/utils/lesson-grade'
import { lessonByKey, routeForLesson } from '@rosie/math-kit/utils/lesson-registry'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet, Problem } from '@rosie/core'
import type { MathPlanSectionKey } from '@rosie/math-kit/utils/math-helpers'
import { sanitizeRichHtml } from '@rosie/math-kit/utils/sanitize-summary-html'

export function problemDetailHref(lessonId: string, section: string, index: number): string {
  const entry = lessonByKey(lessonId)
  const base = entry ? routeForLesson(entry) : `/math/ny/${lessonId}`
  return `${base}/${section}/${index}`
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const MATH_PLAN_LESSONS = [
  {
    id: '1-12',
    label: '第12讲 · 巧算加减法进阶',
    short: '巧算加减法',
    emoji: '🔢',
    color: 'rgba(249,115,22,1)',
    bg: 'rgba(249,115,22,.08)',
    border: 'rgba(249,115,22,.25)',
    desc: '补数·凑整·连续自然数求和',
  },
  {
    id: '1-13',
    label: '第13讲 · 植树问题',
    short: '植树问题',
    emoji: '🌳',
    color: 'rgba(34,197,94,1)',
    bg: 'rgba(34,197,94,.08)',
    border: 'rgba(34,197,94,.25)',
    desc: '两端植·一端植·环形植',
  },
  {
    id: '1-15',
    label: '第15讲 · 和差问题',
    short: '和差问题',
    emoji: '➕',
    color: 'rgba(14,165,233,1)',
    bg: 'rgba(14,165,233,.08)',
    border: 'rgba(14,165,233,.25)',
    desc: '和差公式·移多补少·隐藏差',
  },
  {
    id: '1-18',
    label: '第18讲 · 和差倍初步',
    short: '和差倍初步',
    emoji: '✖️',
    color: 'rgba(168,85,247,1)',
    bg: 'rgba(168,85,247,.08)',
    border: 'rgba(168,85,247,.25)',
    desc: '和倍·差倍·三量联立',
  },
  {
    id: '1-23',
    label: '第23讲 · 逻辑推理',
    short: '逻辑推理',
    emoji: '🔍',
    color: 'rgba(139,92,246,1)',
    bg: 'rgba(139,92,246,.08)',
    border: 'rgba(139,92,246,.25)',
    desc: '排除法·假设法·对应法',
  },
  {
    id: '1-29',
    label: '第29讲 · 算符大作战',
    short: '算符大作战',
    emoji: '🎮',
    color: 'rgba(244,63,94,1)',
    bg: 'rgba(244,63,94,.08)',
    border: 'rgba(244,63,94,.25)',
    desc: '填算符·24点·奇偶性',
  },
  {
    id: '1-30',
    label: '第30讲 · 和差倍进阶',
    short: '和差倍进阶',
    emoji: '🧮',
    color: 'rgba(245,158,11,1)',
    bg: 'rgba(245,158,11,.08)',
    border: 'rgba(245,158,11,.3)',
    desc: '三量联立·倍比·进阶题',
  },
  {
    id: '1-34',
    label: '第34讲 · 乘法分配律',
    short: '乘法分配律问题',
    emoji: '🍑',
    color: 'rgba(159,130,246,1)',
    bg: 'rgba(159,130,246,.08)',
    border: 'rgba(159,130,246,.25)',
    desc: '装一袋，分多袋，找好朋友',
  },
  {
    id: '1-35',
    label: '第35讲 · 归一问题',
    short: '归一问题',
    emoji: '🐦',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,.08)',
    border: 'rgba(59,130,246,.25)',
    desc: '单归一、双归一、反向归一',
  },
  {
    id: '1-36',
    label: '第36讲 · 星期几问题',
    short: '星期几',
    emoji: '📅',
    color: 'rgba(245,158,11,1)',
    bg: 'rgba(245,158,11,.08)',
    border: 'rgba(245,158,11,.3)',
    desc: '同月/跨月/跨年推算',
  },
  {
    id: '1-37',
    label: '第37讲 · 鸡兔同笼问题',
    short: '鸡兔同笼',
    emoji: '🐰',
    color: 'rgba(133,200,11,1)',
    bg: 'rgba(133,200,11,.08)',
    border: 'rgba(133,200,11,.3)',
    desc: '找头和，腿和，否则分组',
  },
  {
    id: '1-38',
    label: '第38讲 · 一笔画',
    short: '一笔画',
    emoji: '✏️',
    color: 'rgba(236,72,153,1)',
    bg: 'rgba(236,72,153,.08)',
    border: 'rgba(236,72,153,.3)',
    desc: '端点·奇点·偶点判断',
  },
  {
    id: '1-39',
    label: '第39讲 · 盈亏问题',
    short: '盈亏问题',
    emoji: '⚖️',
    color: 'rgba(16,185,129,1)',
    bg: 'rgba(16,185,129,.08)',
    border: 'rgba(16,185,129,.3)',
    desc: '总差额 ÷ 每份差额',
  },
  {
    id: '1-40',
    label: '第40讲 · 周长问题',
    short: '周长问题',
    emoji: '📐',
    color: 'rgba(99,102,241,1)',
    bg: 'rgba(99,102,241,.08)',
    border: 'rgba(99,102,241,.3)',
    desc: '拼图·剪切·平移·标向',
  },
  {
    id: '1-41',
    label: '第41讲 · 间隔趣题',
    short: '间隔趣题',
    emoji: '✂️',
    color: 'rgba(249,115,22,1)',
    bg: 'rgba(249,115,22,.08)',
    border: 'rgba(249,115,22,.3)',
    desc: '锯木头·爬楼·敲钟',
  },
  {
    id: '1-42',
    label: '第42讲 · 生活智力题',
    short: '生活智力题',
    emoji: '🧠',
    color: 'rgba(244,63,94,1)',
    bg: 'rgba(244,63,94,.08)',
    border: 'rgba(244,63,94,.3)',
    desc: '称重·换水·计时·找异物',
  },
  {
    id: '1-43',
    label: '第43讲 · 等差数列初识',
    short: '等差数列',
    emoji: '📊',
    color: 'rgba(6,182,212,1)',
    bg: 'rgba(6,182,212,.08)',
    border: 'rgba(6,182,212,.25)',
    desc: '首项·公差·项数·求和公式',
  },
  {
    id: '1-44',
    label: '第44讲 · 统筹优化',
    short: '统筹优化',
    emoji: '⏱️',
    color: 'rgba(99,102,241,1)',
    bg: 'rgba(99,102,241,.08)',
    border: 'rgba(99,102,241,.3)',
    desc: '排队·过河·路径·烙饼',
  },
  {
    id: '1-46',
    label: '第46讲 · 抽屉原理与最不利',
    short: '抽屉·最不利',
    emoji: '🗄️',
    color: 'rgba(20,184,166,1)',
    bg: 'rgba(20,184,166,.08)',
    border: 'rgba(20,184,166,.3)',
    desc: '抽屉原理·最不利·保证问题',
  },
  {
    id: '1-47',
    label: '第47讲 · 方格中的秘密',
    short: '方格谜题',
    emoji: '🧩',
    color: 'rgba(192,38,211,1)',
    bg: 'rgba(192,38,211,.08)',
    border: 'rgba(192,38,211,.3)',
    desc: '数连·数桥·数方·变型数独',
  },
  {
    id: '2-2',
    label: '第2讲 · 等量代换与归一问题',
    short: '归一问题',
    emoji: '⚖️',
    color: 'rgba(20,184,166,1)',
    bg: 'rgba(20,184,166,.08)',
    border: 'rgba(20,184,166,.3)',
    desc: '归一·等量代换·分组统计',
  },
  {
    id: '2-1',
    label: '第1讲 · 加减法速算与巧算',
    short: '速算巧算',
    emoji: '🧮',
    color: 'rgba(99,102,241,1)',
    bg: 'rgba(99,102,241,.08)',
    border: 'rgba(99,102,241,.3)',
    desc: '凑整·去括号·按位相加·基准数',
  },
  {
    id: '2-7',
    label: '第7讲 · 数字谜',
    short: '数字谜',
    emoji: '🔐',
    color: 'rgba(14,165,233,1)',
    bg: 'rgba(14,165,233,.08)',
    border: 'rgba(14,165,233,.3)',
    desc: '加法谜·减法谜·数字和分析',
  },
  {
    id: '2-6',
    label: '第6讲 · 简单枚举',
    short: '简单枚举',
    emoji: '🔢',
    color: 'rgba(20,184,166,1)',
    bg: 'rgba(20,184,166,.08)',
    border: 'rgba(20,184,166,.3)',
    desc: '列举·分堆·组数·隔板',
  },
  {
    id: '2-5',
    label: '第5讲 · 找规律',
    short: '找规律',
    emoji: '🔮',
    color: 'rgba(245,158,11,1)',
    bg: 'rgba(245,158,11,.08)',
    border: 'rgba(245,158,11,.3)',
    desc: '数列·数表·图形编码',
  },
  {
    id: '2-4',
    label: '第4讲 · 差倍问题',
    short: '差倍问题',
    emoji: '📊',
    color: 'rgba(14,165,233,1)',
    bg: 'rgba(14,165,233,.08)',
    border: 'rgba(14,165,233,.3)',
    desc: '差倍·移多补少·年龄·和倍',
  },
  {
    id: '2-3',
    label: '第3讲 · 等量代换与归一问题',
    short: '代换归一',
    emoji: '⚖️',
    color: 'rgba(16,185,129,1)',
    bg: 'rgba(16,185,129,.08)',
    border: 'rgba(16,185,129,.3)',
    desc: '等量代换·消元·归一·反比例',
  },
]

export const CN_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const SECTION_EMOJI: Record<string, string> = {
  lesson: '📖',
  homework: '✏️',
  workbook: '📚',
  pretest: '📝',
  supplement: '📒',
}
export const SECTION_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  lesson: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  homework: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  workbook: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  pretest: { bg: '#fdf4ff', text: '#6b21a8', border: '#e9d5ff' },
  supplement: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** Monday–Sunday ISO dates for the week that contains `isoDate` (local calendar). */
export function mondayWeekDates(isoDate: string): string[] {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = dt.getDay() // 0 = Sunday
  const toMonday = dow === 0 ? -6 : 1 - dow
  dt.setDate(dt.getDate() + toMonday)
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    out.push(`${yy}-${mm}-${dd}`)
    dt.setDate(dt.getDate() + 1)
  }
  return out
}

export function countPlanDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0
  const [y, m, d] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cur = new Date(y, m - 1, d)
  const endDt = new Date(ey, em - 1, ed)
  let n = 0
  while (cur <= endDt) {
    n += 1
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function availableSections(ps: ProblemSet): string[] {
  return MATH_PLAN_SECTIONS.filter(({ key }) => {
    if (key === 'supplement') return (ps.supplement?.length ?? 0) > 0
    if (key === 'workbook') return ps.workbook.length > 0
    if (key === 'lesson') return ps.lesson.length > 0
    if (key === 'homework') return ps.homework.length > 0
    if (key === 'pretest') return ps.pretest.length > 0
    return false
  }).map(s => s.key)
}

export function defaultSectionsForLesson(ps: ProblemSet | undefined): string[] {
  if (!ps) return ['lesson', 'homework', 'pretest']
  const avail = availableSections(ps)
  const preferred = ['lesson', 'homework', 'pretest'].filter(s => avail.includes(s))
  return preferred.length > 0 ? preferred : avail
}

export function fmtPlanRange(start: string, end: string): string {
  return `${fmtDate(start)} — ${fmtDate(end)}`
}

/** Prefer parent-set name; otherwise single-lesson short label or "N 个关卡". */
export function mathPlanDisplayName(plan: MathWeeklyPlan): string {
  const trimmed = plan.name?.trim()
  if (trimmed) return trimmed
  const ids = plan.lessonIds ?? [plan.lessonId]
  if (ids.length === 1) {
    return MATH_PLAN_LESSONS.find(l => l.id === ids[0])?.short
      ?? MATH_PLAN_LESSONS.find(l => l.id === plan.lessonId)?.short
      ?? ids[0]!
  }
  return `${ids.length} 个关卡`
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const LOOKUP_SECTIONS: MathPlanSectionKey[] = ['lesson', 'homework', 'pretest', 'workbook', 'supplement']

function monthsCoveredByPlan(start: string, end: string): string[] {
  const keys: string[] = []
  let y = Number(start.slice(0, 4))
  let m = Number(start.slice(5, 7))
  const ey = Number(end.slice(0, 4))
  const em = Number(end.slice(5, 7))
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return keys.length > 0 ? keys : [start.slice(0, 7)]
}

function sectionProblems(ps: ProblemSet, section: MathPlanSectionKey): Problem[] {
  if (section === 'supplement') return ps.supplement ?? []
  if (section === 'lesson') return ps.lesson
  if (section === 'homework') return ps.homework
  if (section === 'pretest') return ps.pretest
  if (section === 'workbook') return ps.workbook
  return []
}

function resolveTagLabel(
  prob: MathPlanProblem,
  problemSets?: Record<string, ProblemSet>,
): string | undefined {
  if (prob.tagLabel?.trim()) return prob.tagLabel.trim()
  const ps = problemSets?.[prob.lessonId]
  if (!ps) return undefined
  for (const section of LOOKUP_SECTIONS) {
    const found = sectionProblems(ps, section).find((p) => p.id === prob.problemId)
    if (found?.tagLabel) return found.tagLabel
  }
  return undefined
}

/** e.g. "12巧算加减法" — lesson seq + short title only */
export function mathPlanLessonChip(prob: MathPlanProblem): string {
  const seq = lessonDisplayNum(prob.lessonId)
  const short = MATH_PLAN_LESSONS.find((l) => l.id === prob.lessonId)?.short ?? ''
  return seq != null ? `${seq}${short}` : short || prob.lessonId
}

/** e.g. "12巧算加减法-凑整法"；`compact` omits the specific tagLabel (mobile calendar). */
export function mathPlanProblemTypeChip(
  prob: MathPlanProblem,
  problemSets?: Record<string, ProblemSet>,
  opts?: { compact?: boolean },
): string {
  const head = mathPlanLessonChip(prob)
  if (opts?.compact) return head
  const tag = resolveTagLabel(prob, problemSets)
  return tag ? `${head}-${tag}` : head
}

export function uniqueDayTypeChips(
  problems: MathPlanProblem[],
  problemSets?: Record<string, ProblemSet>,
  opts?: { compact?: boolean },
): string[] {
  const seen = new Set<string>()
  const chips: string[] = []
  for (const p of problems) {
    const chip = mathPlanProblemTypeChip(p, problemSets, opts)
    if (seen.has(chip)) continue
    seen.add(chip)
    chips.push(chip)
  }
  return chips
}

function resolveFullProblem(
  prob: MathPlanProblem,
  problemSets?: Record<string, ProblemSet>,
): Problem | undefined {
  const ps = problemSets?.[prob.lessonId]
  if (!ps) return undefined
  for (const section of LOOKUP_SECTIONS) {
    const found = sectionProblems(ps, section).find((p) => p.id === prob.problemId)
    if (found) return found
  }
  return undefined
}

export type PlanPreviewCalendarProps = {
  plan: MathWeeklyPlan
  problemSets?: Record<string, ProblemSet>
  /** Controlled selection (learner map). When omitted with no onSelectDate, uses internal state. */
  selectedDate?: string | null
  onSelectDate?: (date: string | null) => void
  /** Admin preview embeds a read-only problem list; learner map sets false. Default true. */
  showDayDetail?: boolean
  /** Learner: start practice for an unfinished problem on the selected day. */
  onPracticeProblem?: (prob: MathPlanProblem, dayProblems: MathPlanProblem[]) => void
}

function StatusChip({
  label,
  bg,
  color,
  border,
}: {
  label: string
  bg: string
  color: string
  border: string
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  )
}

function DayCellChipStack({
  chips,
  className,
  chipClassName,
  chipStyle,
  max = 4,
}: {
  chips: string[]
  className?: string
  chipClassName?: string
  chipStyle?: CSSProperties
  max?: number
}) {
  const shown = chips.slice(0, max)
  const extra = chips.length - shown.length
  return (
    <div className={className}>
      {shown.map((chip) => (
        <div
          key={chip}
          className={chipClassName}
          style={{ background: 'rgba(255,255,255,.85)', ...chipStyle }}
          title={chip}
        >
          {chip}
        </div>
      ))}
      {extra > 0 && (
        <div className="text-[9px] font-bold text-orange-500">+{extra}</div>
      )}
    </div>
  )
}

export function PlanPreviewCalendar({
  plan,
  problemSets,
  selectedDate: controlledSelected,
  onSelectDate,
  showDayDetail = true,
  onPracticeProblem,
}: PlanPreviewCalendarProps) {
  const { user } = useAuth()
  const { practiceCount } = useMathPracticeStats(user)
  const { wrongIds } = useMathWrong(user)
  const controlled = onSelectDate != null
  const end = planEndDate(plan)
  const months = useMemo(() => monthsCoveredByPlan(plan.weekStart, end), [plan.weekStart, end])
  const [monthIdx, setMonthIdx] = useState(0)
  const [internalSelected, setInternalSelected] = useState<string | null>(null)
  const selectedDate = controlled ? (controlledSelected ?? null) : internalSelected
  const selectedDoneKeys = useMemo(() => {
    if (!selectedDate) return new Set<string>()
    return new Set((plan.progress[selectedDate] ?? { doneKeys: [] }).doneKeys)
  }, [plan.progress, selectedDate])

  const setSelectedDate = (next: string | null) => {
    if (controlled) onSelectDate(next)
    else setInternalSelected(next)
  }

  const monthsKey = months.join(',')
  const [syncedMonthsKey, setSyncedMonthsKey] = useState('')
  if (syncedMonthsKey !== monthsKey) {
    setSyncedMonthsKey(monthsKey)
    const prefer = (controlledSelected ?? todayStr()).slice(0, 7)
    const idx = months.indexOf(prefer)
    setMonthIdx(idx >= 0 ? idx : 0)
  }

  const viewMonth = months[Math.min(monthIdx, months.length - 1)] ?? months[0]!
  const [year, month] = viewMonth.split('-').map(Number) as [number, number]

  const dayMap = useMemo(() => {
    const map = new Map<string, MathPlanProblem[]>()
    for (const day of plan.days) map.set(day.date, day.problems)
    return map
  }, [plan.days])

  /** Only plan days in this month; pad leading/trailing nulls to keep 日–六 columns aligned. */
  const cells = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    const planDates = plan.days
      .map((d) => d.date)
      .filter((date) => date.startsWith(prefix))
      .sort()
    const list: { date: string | null; dayNum: number | null }[] = []
    if (planDates.length === 0) return list

    const first = planDates[0]!
    const leadPad = new Date(`${first}T00:00:00`).getDay()
    for (let i = 0; i < leadPad; i++) list.push({ date: null, dayNum: null })

    for (const date of planDates) {
      list.push({ date, dayNum: Number(date.slice(8, 10)) })
    }

    const trailNeeded = (7 - (list.length % 7)) % 7
    for (let i = 0; i < trailNeeded; i++) list.push({ date: null, dayNum: null })
    return list
  }, [year, month, plan.days])

  const selectedProblems = selectedDate ? (dayMap.get(selectedDate) ?? []) : []

  const canPrev = monthIdx > 0
  const canNext = monthIdx < months.length - 1

  const shiftMonth = (delta: number) => {
    setMonthIdx((i) => {
      const next = Math.min(months.length - 1, Math.max(0, i + delta))
      return next
    })
    if (!controlled) setInternalSelected(null)
  }

  return (
    <div
      className="mt-3 rounded-xl px-3 py-3 md:px-4 md:py-4"
      style={{ background: 'rgba(255,255,255,.7)', border: '1px solid rgba(0,0,0,.06)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => shiftMonth(-1)}
          className="cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-bold text-gray-500 disabled:cursor-default disabled:opacity-30"
          style={{ background: 'rgba(0,0,0,.04)' }}
        >
          ‹
        </button>
        <span className="text-[13px] font-extrabold text-gray-700">
          {year}年{month}月
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => shiftMonth(1)}
          className="cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-bold text-gray-500 disabled:cursor-default disabled:opacity-30"
          style={{ background: 'rgba(0,0,0,.04)' }}
        >
          ›
        </button>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-bold text-gray-400">
            {w}
          </div>
        ))}
      </div>
      {cells.length === 0 ? (
        <div className="py-6 text-center text-[12px] font-bold text-gray-400">本月无计划日</div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (!cell.date) {
              return <div key={`e-${i}`} className="min-h-2" />
            }
            const problems = dayMap.get(cell.date) ?? []
            const compactChips = uniqueDayTypeChips(problems, problemSets, { compact: true })
            const fullChips = uniqueDayTypeChips(problems, problemSets)
            const isSelected = selectedDate === cell.date
            const dayDoneKeys = plan.progress[cell.date]?.doneKeys ?? []
            const doneCount = problems.filter((problem) =>
              isPlanProblemDone(problem, cell.date!, dayDoneKeys),
            ).length
            const isComplete = problems.length > 0 && doneCount === problems.length
            const isOverdueDay = cell.date < todayStr() && !isComplete
            const isDeferredDay = problems.some((problem) => problem.isDeferred)
            const deferredSourceIds = new Set(
              (plan.deferredBatches ?? []).flatMap((batch) => batch.sourceAssignmentIds),
            )
            const isDeferredSourceDay = problems.some((problem) =>
              deferredSourceIds.has(problem.assignmentId ?? `${cell.date}::${problem.key}`),
            )
            return (
              <button
                type="button"
                key={cell.date}
                onClick={() => {
                  if (controlled && !showDayDetail) {
                    setSelectedDate(cell.date)
                    return
                  }
                  setSelectedDate(selectedDate === cell.date ? null : cell.date)
                }}
                className="min-h-24 cursor-pointer rounded-lg px-1 py-1 text-left transition-all md:min-h-32 md:px-1.5 md:py-1.5"
                style={{
                  background: isSelected
                    ? 'rgba(251,146,60,.22)'
                    : isComplete
                      ? 'rgba(134,239,172,.45)'
                      : isOverdueDay
                        ? 'rgba(254,202,202,.55)'
                        : isDeferredDay
                          ? 'rgba(221,214,254,.6)'
                    : problems.length > 0
                      ? 'rgba(251,146,60,.1)'
                      : 'rgba(251,146,60,.04)',
                  border: isSelected
                    ? '2px solid rgba(234,88,12,.55)'
                    : isComplete
                      ? '1.5px solid rgba(34,197,94,.55)'
                      : isOverdueDay
                        ? '1.5px solid rgba(239,68,68,.5)'
                        : isDeferredDay
                          ? '1.5px solid rgba(124,58,237,.45)'
                    : '1px solid rgba(251,146,60,.22)',
                  boxShadow: isSelected ? '0 2px 10px rgba(249,115,22,.2)' : 'none',
                }}
              >
                <div className="text-[11px] font-bold text-orange-700 md:text-[12px]">
                  {cell.dayNum}
                  {problems.length > 0 && (
                    <span className="ml-1 text-[9px] font-medium text-orange-500/80">
                      {problems.length}题
                    </span>
                  )}
                </div>
                {problems.length > 0 && (
                  <div className="mt-0.5 text-[8px] font-extrabold" style={{ color: isComplete ? '#15803d' : isOverdueDay ? '#dc2626' : isDeferredDay ? '#7c3aed' : '#c2410c' }}>
                    {isComplete ? (isDeferredDay ? '延期完成' : '已完成') : isDeferredSourceDay ? '过期·已延期' : isOverdueDay ? '已过期' : isDeferredDay ? '延期任务' : `未执行 ${doneCount}/${problems.length}`}
                  </div>
                )}
                {/* Mobile: lesson only (e.g. 7数字谜). Desktop: include tagLabel. */}
                <DayCellChipStack
                  chips={compactChips}
                  className="mt-1 flex flex-col gap-0.5 md:hidden"
                  chipClassName="rounded px-1 py-0.5 text-[9px] leading-snug font-bold break-words text-orange-900"
                />
                <DayCellChipStack
                  chips={fullChips}
                  className="mt-1 hidden flex-col gap-1 md:flex"
                  chipClassName="rounded px-1 py-0.5 text-[10px] leading-snug font-bold break-words text-orange-900"
                />
              </button>
            )
          })}
        </div>
      )}

      {showDayDetail && selectedDate && (
        <div
          className="mt-4 space-y-3 rounded-xl px-3 py-3 md:px-4"
          style={{ background: 'rgba(255,248,240,.9)', border: '1.5px solid rgba(251,146,60,.25)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-extrabold text-orange-900">
              {dayLabel(selectedDate)} · {fmtDate(selectedDate)}
              <span className="ml-2 text-[11px] font-bold text-orange-500">
                {selectedProblems.length} 道题
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-400 hover:text-gray-600"
              style={{ background: 'rgba(0,0,0,.05)' }}
            >
              关闭
            </button>
          </div>
          {selectedProblems.length === 0 ? (
            <div className="py-4 text-center text-[12px] font-bold text-gray-400">当日无必做题</div>
          ) : (
            selectedProblems.map((prob, idx) => {
              const full = resolveFullProblem(prob, problemSets)
              const typeChip = mathPlanProblemTypeChip(prob, problemSets)
              const sc = SECTION_COLOR[prob.section] ?? SECTION_COLOR.lesson
              const exec = isPlanProblemDone(prob, selectedDate!, selectedDoneKeys) ? 'done' : 'pending'
              const answer = planProblemAnswerStatus(prob.problemId, {
                wrongIds,
                practiceCount,
              })
              const isOverdue = Boolean(selectedDate && selectedDate < todayStr() && exec === 'pending')
              return (
                <article
                  key={prob.key}
                  className="rounded-xl px-3.5 py-3"
                  style={{
                    background: 'rgba(255,255,255,.92)',
                    border: '1.5px solid rgba(0,0,0,.06)',
                  }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-extrabold text-gray-500">{idx + 1}.</span>
                    <span className="text-[13px] font-extrabold text-gray-800">{prob.title}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                    >
                      {MATH_PLAN_SECTIONS.find((s) => s.key === prob.section)?.label ?? prob.section}
                    </span>
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                      {typeChip}
                    </span>
                    <StatusChip
                      label={exec === 'done' ? '执行·已完成' : isOverdue ? '执行·过期未做' : '执行·未做'}
                      bg={exec === 'done' ? 'rgba(34,197,94,.12)' : 'rgba(249,115,22,.12)'}
                      color={exec === 'done' ? '#15803d' : '#c2410c'}
                      border={exec === 'done' ? 'rgba(34,197,94,.35)' : 'rgba(249,115,22,.35)'}
                    />
                    {prob.isDeferred && (
                      <StatusChip
                        label={`延期自 ${fmtDate(prob.deferredFromDate ?? '')}`}
                        bg="rgba(124,58,237,.12)"
                        color="#6d28d9"
                        border="rgba(124,58,237,.3)"
                      />
                    )}
                    <StatusChip
                      label={
                        answer === 'wrong' ? '答题·错题' : answer === 'practiced' ? '答题·已练' : '答题·未练'
                      }
                      bg={
                        answer === 'wrong'
                          ? 'rgba(239,68,68,.12)'
                          : answer === 'practiced'
                            ? 'rgba(59,130,246,.12)'
                            : 'rgba(0,0,0,.05)'
                      }
                      color={
                        answer === 'wrong' ? '#dc2626' : answer === 'practiced' ? '#1d4ed8' : '#6b7280'
                      }
                      border={
                        answer === 'wrong'
                          ? 'rgba(239,68,68,.35)'
                          : answer === 'practiced'
                            ? 'rgba(59,130,246,.35)'
                            : 'rgba(0,0,0,.1)'
                      }
                    />
                  </div>
                  {full?.text ? (
                    <div
                      className="text-[13px] leading-relaxed text-gray-700 [&_strong]:font-extrabold [&_strong]:text-orange-800"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(full.text) }}
                    />
                  ) : (
                    <div className="text-[12px] font-medium text-gray-400">
                      暂无题目正文（缺少题库数据）
                    </div>
                  )}
                  {full && (
                    <div className="mt-2 text-[11px] font-bold text-gray-400">
                      问：{full.finalQ}
                      {full.finalUnit ? `（${full.finalUnit}）` : ''}
                    </div>
                  )}
                  {onPracticeProblem && exec === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onPracticeProblem(prob, selectedProblems)}
                      className="mt-3 cursor-pointer rounded-md px-3 py-2 text-[12px] font-extrabold text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
                    >
                      做题 ✨
                    </button>
                  )}
                </article>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export function dayLabel(dateStr: string): string {
  return CN_DAYS[new Date(dateStr + 'T00:00:00').getDay()]
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── Sub-components ─────────────────────────────────────────────────────────────

export function SectionHeader({
  icon,
  label,
  count,
  accent = '#6b7280',
}: {
  icon: string
  label: string
  count: number
  accent?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span
        className="text-[12px] font-extrabold tracking-wider uppercase"
        style={{ color: accent }}
      >
        {label}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
        style={{ background: `${accent}15`, color: accent }}
      >
        {count} 题
      </span>
      <div className="h-px flex-1" style={{ background: `${accent}20` }} />
    </div>
  )
}

export function CollapsibleSection({
  icon,
  label,
  count,
  accent = '#6b7280',
  defaultExpanded = true,
  headerRight,
  children,
}: {
  icon: string
  label: string
  count: number
  accent?: string
  defaultExpanded?: boolean
  /** Extra element next to the toggle (sibling, not nested), e.g. action buttons. */
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div>
      {/* Toggle is its own button; headerRight stays a sibling so nested <button> is illegal HTML. */}
      <div className="flex w-full items-center gap-2 rounded-lg py-1">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left transition-all hover:bg-black/3"
        >
          <span className="text-base">{icon}</span>
          <span
            className="text-[12px] font-extrabold tracking-wider uppercase"
            style={{ color: accent }}
          >
            {label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
            style={{ background: `${accent}15`, color: accent }}
          >
            {count} 题
          </span>
          <div className="h-px flex-1" style={{ background: `${accent}20` }} />
          <span
            className="shrink-0 text-[10px] font-bold transition-transform duration-200"
            style={{ color: accent, transform: expanded ? 'rotate(180deg)' : 'none' }}
          >
            ▾
          </span>
        </button>
        {headerRight != null && <div className="shrink-0">{headerRight}</div>}
      </div>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function EmptyDay() {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-[14px] py-6 text-center"
      style={{ background: 'rgba(0,0,0,.03)', border: '1.5px dashed rgba(0,0,0,.08)' }}
    >
      <span className="text-2xl">😴</span>
      <div className="text-[12px] font-medium text-gray-400">今天没有安排，好好休息！</div>
    </div>
  )
}

export function ProblemCard({
  prob,
  done,
  isReview,
  isWrong,
  onPractice,
  problemSets,
  hasDraft,
  overdueDate,
  deferredSource,
}: {
  prob: MathPlanProblem
  done: boolean
  isReview?: boolean
  isWrong?: boolean
  /** When set,「做题」starts immersive practice instead of navigating to detail. */
  onPractice?: () => void
  /** Resolve live Problem for draft pad (plan page). */
  problemSets?: Record<string, ProblemSet>
  /** Batched draft presence from plan page — avoids per-card fetches. */
  hasDraft?: boolean
  /** ISO date when this card is an overdue make-up item. */
  overdueDate?: string
  /** Historical occurrence already copied to a later independent assignment. */
  deferredSource?: boolean
}) {
  const { user } = useAuth()
  const { practiceCount } = useMathPracticeStats(user)
  const problemPracticeCount = practiceCount[prob.problemId] ?? 0
  const sc = SECTION_COLOR[prob.section] ?? SECTION_COLOR.lesson
  const draftProblem = problemSets ? resolveMathPlanProblem(prob, problemSets) : undefined
  const answerLabel = isWrong ? '答题·错题' : problemPracticeCount > 0 ? '答题·已练' : '答题·未练'
  const execLabel = done
    ? prob.isDeferred ? '执行·延期完成' : '执行·已完成'
    : deferredSource ? '执行·过期已延期' : overdueDate ? '执行·过期未做' : prob.isDeferred ? '执行·延期任务' : '执行·未做'

  return (
    <div
      className="group flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all duration-300"
      style={{
        background: done ? 'rgba(220,252,231,.6)' : prob.isDeferred ? 'rgba(245,243,255,.88)' : isWrong ? 'rgba(254,226,226,.5)' : 'rgba(255,255,255,.85)',
        border: `1.5px solid ${done ? '#86efac' : prob.isDeferred ? 'rgba(124,58,237,.38)' : isWrong ? 'rgba(239,68,68,.35)' : overdueDate ? 'rgba(239,68,68,.28)' : 'rgba(0,0,0,.07)'}`,
        boxShadow: done ? 'none' : '0 2px 10px rgba(0,0,0,.04)',
      }}
    >
      {/* Done / wrong indicator — display only; completion comes from practice sync */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: done
            ? 'linear-gradient(135deg, #22c55e, #4ade80)'
            : isWrong
              ? 'linear-gradient(135deg, #ef4444, #f87171)'
              : 'rgba(0,0,0,.05)',
          border: done || isWrong ? 'none' : '2px solid rgba(0,0,0,.1)',
          boxShadow: done
            ? '0 2px 8px rgba(34,197,94,.4)'
            : isWrong
              ? '0 2px 8px rgba(239,68,68,.4)'
              : 'none',
        }}
        aria-hidden
      >
        {done && <span className="text-[14px] font-extrabold text-white">✓</span>}
        {!done && isWrong && <span className="text-[14px] font-extrabold text-white">✗</span>}
      </div>

      {/* Section badge */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[14px]"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        {SECTION_EMOJI[prob.section] ?? '📋'}
      </div>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] leading-snug font-bold ${done ? 'text-green-600 line-through opacity-70' : 'text-gray-800'}`}
        >
          {prob.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium" style={{ color: sc.text }}>
            {lessonDisplayLabel(prob.lessonId, true)}
          </span>
          {overdueDate && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(239,68,68,.12)', color: '#dc2626' }}
            >
              {fmtDate(overdueDate)} 欠
            </span>
          )}
          {prob.isDeferred && (
            <span className="rounded-full px-1.5 py-px text-[9px] font-extrabold" style={{ background: 'rgba(124,58,237,.12)', color: '#6d28d9' }}>
              延期自 {fmtDate(prob.deferredFromDate ?? '')}
            </span>
          )}
          {isReview && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(245,158,11,.12)', color: '#b45309' }}
            >
              复习
            </span>
          )}
          <span
            className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
            style={{
              background: done ? 'rgba(34,197,94,.12)' : 'rgba(249,115,22,.12)',
              color: done ? '#15803d' : '#c2410c',
            }}
          >
            {execLabel}
          </span>
          <span
            className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
            style={{
              background: isWrong
                ? 'rgba(239,68,68,.12)'
                : problemPracticeCount > 0
                  ? 'rgba(59,130,246,.12)'
                  : 'rgba(0,0,0,.05)',
              color: isWrong ? '#dc2626' : problemPracticeCount > 0 ? '#1d4ed8' : '#6b7280',
            }}
          >
            {answerLabel}
          </span>
          <PracticeCountBadge count={problemPracticeCount} />
        </div>
      </div>

      {/* Do button */}
      {!done && onPractice && (
        <button
          type="button"
          onClick={onPractice}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(249,115,22,.4)]"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          做题 ✨
        </button>
      )}
      {!done && !onPractice && (
        <Link
          href={problemDetailHref(prob.lessonId, prob.section, prob.index)}
          className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(249,115,22,.4)]"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          做题 ✨
        </Link>
      )}
      {done && (
        <PracticeViewDraftButton
          problem={draftProblem ?? undefined}
          problemId={prob.problemId}
          section={prob.section}
          hasDraft={hasDraft}
          className="shrink-0"
        />
      )}
      {done && <span className="animate-star-pop inline-block shrink-0 text-[20px]">⭐</span>}
      <FavoriteHeart problemId={prob.problemId} size="sm" />
    </div>
  )
}

export function WeeklyLessonSection({
  problem,
  lessonId,
  reviewCount,
  coveredCount,
  totalCount,
  isDone,
  onSkip,
  onPractice,
  problemSets,
  hasDraft,
}: {
  problem: MathPlanProblem
  lessonId: string
  reviewCount: number
  coveredCount: number
  totalCount: number
  isDone: boolean
  onSkip: () => void
  onPractice?: () => void
  problemSets?: Record<string, ProblemSet>
  hasDraft?: boolean
}) {
  const sc = SECTION_COLOR[problem.section] ?? SECTION_COLOR.lesson

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">📅</span>
        <span
          className="text-[12px] font-extrabold tracking-wider uppercase"
          style={{ color: '#7c3aed' }}
        >
          本周旧讲
        </span>
        <span className="text-[11px] font-bold text-purple-500">{lessonDisplayLabel(lessonId, true)}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
          style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed' }}
        >
          已覆盖 {coveredCount}/{totalCount} 题
        </span>
        <div className="h-px flex-1" style={{ background: 'rgba(124,58,237,.15)' }} />
      </div>

      <div
        className="flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all duration-300"
        style={{
          background: isDone ? 'rgba(220,252,231,.6)' : 'rgba(255,255,255,.85)',
          border: `1.5px solid ${isDone ? '#86efac' : 'rgba(124,58,237,.2)'}`,
          boxShadow: isDone ? 'none' : '0 2px 10px rgba(124,58,237,.06)',
        }}
      >
        {/* Done indicator */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isDone ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(0,0,0,.05)',
            border: isDone ? 'none' : '2px solid rgba(0,0,0,.1)',
            boxShadow: isDone ? '0 2px 8px rgba(34,197,94,.4)' : 'none',
          }}
        >
          {isDone && <span className="text-[14px] font-extrabold text-white">✓</span>}
        </div>

        {/* Section badge */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[14px]"
          style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
        >
          {SECTION_EMOJI[problem.section] ?? '📋'}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <div
            className={`text-[13px] leading-snug font-bold ${isDone ? 'text-green-600 line-through opacity-70' : 'text-gray-800'}`}
          >
            {problem.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] font-medium" style={{ color: sc.text }}>
              {lessonDisplayLabel(problem.lessonId, true)}
            </span>
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed' }}
            >
              旧讲
            </span>
            {reviewCount > 0 && (
              <span
                className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
                style={{ background: 'rgba(0,0,0,.06)', color: '#9ca3af' }}
              >
                ×{reviewCount}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isDone ? (
          <div className="flex shrink-0 items-center gap-2">
            <PracticeViewDraftButton
              problem={problemSets ? resolveMathPlanProblem(problem, problemSets) ?? undefined : undefined}
              problemId={problem.problemId}
              section={problem.section}
              hasDraft={hasDraft}
            />
            <span className="animate-star-pop inline-block text-[20px]">⭐</span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {onPractice ? (
              <button
                type="button"
                onClick={onPractice}
                className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(124,58,237,.4)]"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              >
                做题 ✨
              </button>
            ) : (
              <Link
                href={problemDetailHref(problem.lessonId, problem.section, problem.index)}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(124,58,237,.4)]"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              >
                做题 ✨
              </Link>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="cursor-pointer rounded-md px-2.5 py-2 text-[11px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
              style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)' }}
            >
              跳过
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function OptionalSection({
  problems,
  doneKeys,
  date,
  onPractice,
  problemSets,
  draftProblemIds,
}: {
  problems: MathPlanProblem[]
  doneKeys: Set<string>
  date: string
  onPractice?: (prob: MathPlanProblem) => void
  problemSets?: Record<string, ProblemSet>
  draftProblemIds?: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const doneCount = problems.filter((p) => isPlanProblemDone(p, date, doneKeys)).length

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-black/3"
        style={{ border: '1.5px dashed rgba(0,0,0,.1)' }}
      >
        <span className="text-base">🌟</span>
        <span className="text-[12px] font-extrabold tracking-wider text-gray-400 uppercase">
          选做题 · {problems.length} 题
        </span>
        {doneCount > 0 && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-extrabold text-yellow-700">
            已做 {doneCount}
          </span>
        )}
        <span
          className="ml-auto text-[12px] text-gray-300 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          {problems.map((prob) => (
            <ProblemCard
              key={prob.key}
              prob={prob}
              done={isPlanProblemDone(prob, date, doneKeys)}
              problemSets={problemSets}
              hasDraft={draftProblemIds?.has(prob.problemId) ?? false}
              onPractice={
                isPlanProblemDone(prob, date, doneKeys) || !onPractice ? undefined : () => onPractice(prob)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AllPlansList({
  plans,
  currentWeekStart: _currentWeekStart,
  onDelete,
  onEdit,
  defaultExpanded = false,
  problemSets,
}: {
  plans: MathWeeklyPlan[]
  currentWeekStart: string
  onDelete: (weekStart: string) => void
  onEdit: (plan: MathWeeklyPlan) => void
  /** 管理页应设为 true，避免计划列表默认折叠看不见 */
  defaultExpanded?: boolean
  /** Used to resolve tagLabel for legacy plans missing it on stored problems */
  problemSets?: Record<string, ProblemSet>
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set())

  const toggleDayPreview = (weekStart: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev)
      if (next.has(weekStart)) next.delete(weekStart)
      else next.add(weekStart)
      return next
    })
  }

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-black/3"
        style={{ border: '1.5px dashed rgba(0,0,0,.08)' }}
      >
        <span className="text-base">📋</span>
        <span className="text-[12px] font-extrabold tracking-wider text-gray-400 uppercase">
          计划列表 · {plans.length} 个
        </span>
        <span
          className="ml-auto text-[12px] text-gray-300 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {plans.map((plan) => {
            const ids = plan.lessonIds ?? [plan.lessonId]
            const lessonInfo = MATH_PLAN_LESSONS.find(l => l.id === plan.lessonId) ?? MATH_PLAN_LESSONS[0]
            const title = mathPlanDisplayName(plan)
            const t = todayStr()
            const isCurrent = plan.weekStart <= t && t <= planEndDate(plan)
            const endDate = planEndDate(plan)
            const isPast = endDate < todayStr()
            const totalProblems = plan.days.reduce((sum, d) => sum + d.problems.length, 0)
            const dayCount = plan.days.length
            const daysOpen = openDays.has(plan.weekStart)
            return (
              <div
                key={plan.weekStart}
                className="rounded-lg px-3.5 py-3"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, ${lessonInfo.bg}, rgba(255,255,255,.6))`
                    : 'rgba(255,255,255,.7)',
                  border: `1.5px solid ${isCurrent ? lessonInfo.border : 'rgba(0,0,0,.07)'}`,
                  opacity: isPast && !isCurrent ? 0.7 : 1,
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xl">{ids.length === 1 ? lessonInfo.emoji : '📚'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-gray-700">
                      {title}
                      {isCurrent && (
                        <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-px text-[9px] font-extrabold text-orange-600">
                          进行中
                        </span>
                      )}
                      {isPast && !isCurrent && (
                        <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-bold text-gray-400">
                          已过期
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-400">
                      {fmtDate(plan.weekStart)} — {fmtDate(endDate)}
                      <span className="mx-1 text-gray-300">·</span>
                      截止 {fmtDate(endDate)}
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-orange-600/80">
                      {totalProblems} 题 · {dayCount} 天 · 每天约 {plan.problemsPerDay} 题
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDayPreview(plan.weekStart)}
                    className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
                    style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.07)' }}
                    aria-expanded={daysOpen}
                  >
                    {daysOpen ? '收起' : '预览'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(plan)}
                    className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-gray-400 transition-all hover:scale-105 hover:text-gray-600"
                    style={{ background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.07)' }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(plan.weekStart)}
                    className="cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold text-red-300 transition-all hover:scale-105 hover:text-red-500"
                    style={{
                      background: 'rgba(239,68,68,.06)',
                      border: '1px solid rgba(239,68,68,.15)',
                    }}
                  >
                    删除
                  </button>
                </div>
                {daysOpen && <PlanPreviewCalendar plan={plan} problemSets={problemSets} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
