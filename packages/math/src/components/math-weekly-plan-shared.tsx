'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { MATH_PLAN_SECTIONS, planEndDate } from '@rosie/math/utils/math-helpers'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import { todayStr } from '@rosie/core'
import { lessonDisplayLabel } from '@rosie/math/utils/lesson-grade'
import { lessonByKey, routeForLesson } from '@rosie/math/utils/lesson-registry'
import type { MathWeeklyPlan, MathPlanProblem, ProblemSet } from '@rosie/core'
import type { MathPlanSectionKey } from '@rosie/math/utils/math-helpers'

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
  onCheck,
}: {
  prob: MathPlanProblem
  done: boolean
  isReview?: boolean
  isWrong?: boolean
  onCheck?: () => void
}) {
  const { user } = useAuth()
  const { solveCount } = useMathSolved(user)
  const practiceCount = solveCount[prob.problemId] ?? 0
  const sc = SECTION_COLOR[prob.section] ?? SECTION_COLOR.lesson

  return (
    <div
      className="group flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all duration-300"
      style={{
        background: done ? 'rgba(220,252,231,.6)' : 'rgba(255,255,255,.85)',
        border: `1.5px solid ${done ? '#86efac' : 'rgba(0,0,0,.07)'}`,
        boxShadow: done ? 'none' : '0 2px 10px rgba(0,0,0,.04)',
      }}
    >
      {/* Done indicator / clickable checkbox */}
      <button
        type="button"
        onClick={onCheck}
        disabled={done || !onCheck}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          background: done ? 'linear-gradient(135deg, #22c55e, #4ade80)' : 'rgba(0,0,0,.05)',
          border: done ? 'none' : '2px solid rgba(0,0,0,.1)',
          boxShadow: done ? '0 2px 8px rgba(34,197,94,.4)' : 'none',
          cursor: done ? 'default' : onCheck ? 'pointer' : 'default',
        }}
      >
        {done && <span className="text-[14px] font-extrabold text-white">✓</span>}
      </button>

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
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[10px] font-medium" style={{ color: sc.text }}>
            {lessonDisplayLabel(prob.lessonId, true)}
          </span>
          {isReview && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(245,158,11,.12)', color: '#b45309' }}
            >
              复习
            </span>
          )}
          {isWrong && (
            <span
              className="rounded-full px-1.5 py-px text-[9px] font-extrabold"
              style={{ background: 'rgba(239,68,68,.12)', color: '#dc2626' }}
            >
              错题
            </span>
          )}
          <PracticeCountBadge count={practiceCount} />
        </div>
      </div>

      {/* Do button */}
      {!done && (
        <Link
          href={problemDetailHref(prob.lessonId, prob.section, prob.index)}
          className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(249,115,22,.4)]"
          style={{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }}
        >
          做题 ✨
        </Link>
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
}: {
  problem: MathPlanProblem
  lessonId: string
  reviewCount: number
  coveredCount: number
  totalCount: number
  isDone: boolean
  onSkip: () => void
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
          <span className="animate-star-pop inline-block shrink-0 text-[20px]">⭐</span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={problemDetailHref(problem.lessonId, problem.section, problem.index)}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-[12px] font-extrabold text-white no-underline transition-all duration-200 hover:scale-105 hover:shadow-[0_4px_12px_rgba(124,58,237,.4)]"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              做题 ✨
            </Link>
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
  onCheck,
}: {
  problems: MathPlanProblem[]
  doneKeys: Set<string>
  onCheck?: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const doneCount = problems.filter((p) => doneKeys.has(p.key)).length

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
              done={doneKeys.has(prob.key)}
              onCheck={doneKeys.has(prob.key) ? undefined : () => onCheck?.(prob.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AllPlansList({
  plans,
  currentWeekStart,
  onDelete,
  onEdit,
  defaultExpanded = false,
}: {
  plans: MathWeeklyPlan[]
  currentWeekStart: string
  onDelete: (weekStart: string) => void
  onEdit: (plan: MathWeeklyPlan) => void
  /** 管理页应设为 true，避免计划列表默认折叠看不见 */
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

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
            const label =
              ids.length === 1
                ? (MATH_PLAN_LESSONS.find(l => l.id === ids[0])?.short ?? lessonInfo.short)
                : `${ids.length} 个关卡`
            const t = todayStr()
            const isCurrent = plan.weekStart <= t && t <= planEndDate(plan)
            const endDate = planEndDate(plan)
            const isPast = endDate < todayStr()
            return (
              <div
                key={plan.weekStart}
                className="flex items-center gap-3 rounded-lg px-3.5 py-3"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, ${lessonInfo.bg}, rgba(255,255,255,.6))`
                    : 'rgba(255,255,255,.7)',
                  border: `1.5px solid ${isCurrent ? lessonInfo.border : 'rgba(0,0,0,.07)'}`,
                  opacity: isPast && !isCurrent ? 0.7 : 1,
                }}
              >
                <span className="shrink-0 text-xl">{lessonInfo.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-gray-700">
                    {label}
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
                </div>
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
            )
          })}
        </div>
      )}
    </div>
  )
}