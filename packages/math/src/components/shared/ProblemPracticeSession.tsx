'use client'

import { useState, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { SOURCE_LABELS } from '@rosie/core'
import { SEA_LESSON_MAP, type SeaProblem } from '@rosie/math/utils/sea-data'
import QuestionLayout from '@rosie/math/components/shared/QuestionLayout'
import ProblemSolutionPanel from '@rosie/math/components/shared/ProblemSolutionPanel'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import { useProblemAnswer } from '@rosie/math/hooks/useProblemAnswer'
import { isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import { useStarHud, StarProgressBar } from '@rosie/rewards'

// ── Shared mastery helpers (single source of truth; SeaGrid re-imports these) ───

export function getBadgeStyle(count: number): CSSProperties {
  if (count === 0) return { background: 'rgba(0,229,255,0.07)', color: 'rgba(90,142,176,0.8)', border: '1.5px solid rgba(0,229,255,0.15)', boxShadow: 'none' }
  if (count === 1) return { background: 'rgba(0,212,180,0.12)', color: '#00d4b4', border: '1.5px solid rgba(0,212,180,0.4)', boxShadow: '0 0 6px rgba(0,212,180,0.15)' }
  if (count === 2) return { background: 'rgba(0,229,255,0.13)', color: '#00e5ff', border: '1.5px solid rgba(0,229,255,0.55)', boxShadow: '0 0 8px rgba(0,229,255,0.2)' }
  return { background: 'rgba(255,209,102,0.14)', color: '#ffd166', border: '1.5px solid rgba(255,209,102,0.6)', boxShadow: '0 0 10px rgba(255,185,50,0.25)' }
}

export function getMasteryLabel(count: number): string {
  if (count === 0) return '·'
  if (count === 1) return '🥚'
  if (count === 2) return '🐛'
  return '🦋'
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Light-theme badge for MATH_SKIN
function mathBadgeStyle(count: number): CSSProperties {
  if (count === 0) return { background: '#f1f5f9', color: '#94a3b8', border: '1.5px solid #e2e8f0', boxShadow: 'none' }
  if (count === 1) return { background: '#d1fae5', color: '#059669', border: '1.5px solid #6ee7b7', boxShadow: 'none' }
  if (count === 2) return { background: '#dbeafe', color: '#2563eb', border: '1.5px solid #93c5fd', boxShadow: 'none' }
  return { background: '#fef3c7', color: '#d97706', border: '1.5px solid #fcd34d', boxShadow: 'none' }
}

// ── Selection logic (unchanged from sea) ────────────────────────────────────────

// Section weights for random practice (higher = more likely to be picked)
// supplement is excluded entirely; lesson has highest priority
const SECTION_WEIGHT: Record<string, number> = {
  lesson: 4,
  pretest: 3,
  homework: 2,
  workbook: 1,
}

function pickWeighted(items: SeaProblem[]): SeaProblem {
  const total = items.reduce((s, sp) => s + (SECTION_WEIGHT[sp.section] ?? 1), 0)
  let r = Math.random() * total
  for (const sp of items) {
    r -= SECTION_WEIGHT[sp.section] ?? 1
    if (r <= 0) return sp
  }
  return items[items.length - 1]
}

function pickFromFilteredPool(
  pool: SeaProblem[],
  solveCount: Record<string, number>,
  excludeProblemId?: string,
): SeaProblem | null {
  if (pool.length === 0) return null
  let candidates =
    excludeProblemId && pool.length > 1
      ? pool.filter((sp) => sp.problem.id !== excludeProblemId)
      : [...pool]
  if (candidates.length === 0) candidates = [...pool]

  const untried = candidates.filter((sp) => (solveCount[sp.problem.id] ?? 0) === 0)
  const pickFrom = untried.length > 0 ? untried : candidates
  return pickWeighted(pickFrom)
}

// ── Skin ────────────────────────────────────────────────────────────────────────

type SkinPiece = { className?: string; style?: CSSProperties }

type ParticleDef = { id: number; x: string; size: number; dur: number; delay: number; alt: boolean }

export type PracticeSkin = {
  // text / labels
  sessionTitle: string
  progressLabel: string
  hintText: (untriedCount: number, poolTotal?: number) => string
  emptyIcon: string
  emptyTitle: string
  emptySubtitle: string
  // raw css color strings
  titleColor: string
  bodyColor: string
  mutedColor: string
  // region containers (visual; layout classes stay at call site)
  overlayBg: SkinPiece
  panel: SkinPiece
  sessionBg: SkinPiece
  header: SkinPiece
  headerTitle: SkinPiece
  progressBar: SkinPiece
  actionBar: SkinPiece
  // buttons (visual; layout classes stay at call site)
  closeBtn: SkinPiece
  emptyBtn: SkinPiece
  primaryBtn: SkinPiece
  secondaryBtn: SkinPiece
  chip: SkinPiece
  // single-problem
  linkClassName: string
  // ocean-only decoration
  particles?: ParticleDef[]
  depthDivider: boolean
  starColor: 'blue' | 'yellow' | 'red'
  // mastery helpers
  badgeStyle: (count: number) => CSSProperties
  masteryLabel: (count: number) => string
  formatDate: (iso: string) => string
}

export const SEA_SKIN: PracticeSkin = {
  sessionTitle: '深海随机练',
  progressLabel: '本次海上探索',
  hintText: (n, total) =>
    total !== undefined ? `筛选 ${total} 题 · ${n} 题未练` : `未做题优先 · ${n} 题待探索`,
  emptyIcon: '🌊',
  emptyTitle: '没有符合条件的题目',
  emptySubtitle: '调整筛选条件再试试',
  titleColor: '#c8e6f5',
  bodyColor: 'rgba(90,142,176,0.8)',
  mutedColor: 'rgba(90,142,176,0.7)',
  overlayBg: { className: 'sea-root', style: { background: 'rgba(2,16,30,0.96)', backdropFilter: 'blur(16px)' } },
  panel: { className: '', style: { background: 'rgba(5,27,55,0.95)', border: '1px solid rgba(0,229,255,0.25)', boxShadow: '0 0 40px rgba(0,229,255,0.15)' } },
  sessionBg: { className: 'sea-root', style: { background: 'linear-gradient(180deg, #020b1c 0%, #041630 50%, #051a3a 100%)', minHeight: '100dvh' } },
  header: { className: '', style: { background: 'rgba(2,11,28,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,229,255,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' } },
  headerTitle: { className: '', style: { color: '#00e5ff', textShadow: '0 0 12px rgba(0,229,255,0.5)' } },
  progressBar: { className: '', style: { background: 'rgba(2,11,28,0.7)', borderBottom: '1px solid rgba(0,229,255,0.1)' } },
  actionBar: { className: '', style: { background: 'rgba(2,11,28,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(0,229,255,0.12)', boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' } },
  closeBtn: { className: '', style: { background: 'rgba(0,229,255,0.08)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' } },
  emptyBtn: { className: 'lure-btn', style: { background: 'rgba(0,229,255,0.12)', color: '#00e5ff' } },
  primaryBtn: { className: 'lure-btn', style: { background: 'rgba(0,229,255,0.10)', border: '1.5px solid rgba(0,229,255,0.6)', color: '#00e5ff' } },
  secondaryBtn: { className: '', style: { background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.15)', color: 'rgba(200,230,245,0.8)' } },
  chip: { className: '', style: { background: 'rgba(0,229,255,0.12)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' } },
  linkClassName: 'text-cyan-500 no-underline hover:text-cyan-300 transition-colors',
  particles: [
    { id: 1, x: '4%', size: 4, dur: 20, delay: -3, alt: false },
    { id: 2, x: '11%', size: 7, dur: 25, delay: -9, alt: true },
    { id: 3, x: '19%', size: 3, dur: 16, delay: -1, alt: false },
    { id: 4, x: '27%', size: 9, dur: 28, delay: -14, alt: true },
    { id: 5, x: '35%', size: 4, dur: 18, delay: -6, alt: false },
    { id: 6, x: '44%', size: 6, dur: 22, delay: -11, alt: true },
  ],
  depthDivider: true,
  starColor: 'blue',
  badgeStyle: getBadgeStyle,
  masteryLabel: getMasteryLabel,
  formatDate,
}

export const MATH_SKIN: PracticeSkin = {
  sessionTitle: '随机练习',
  progressLabel: '本次练习',
  hintText: (n, total) =>
    total !== undefined ? `筛选 ${total} 题 · ${n} 题未练` : `未做优先 · 还有 ${n} 题`,
  emptyIcon: '📭',
  emptyTitle: '没有符合条件的题目',
  emptySubtitle: '调整筛选条件再试试',
  titleColor: 'var(--color-text-primary)',
  bodyColor: 'var(--color-text-secondary)',
  mutedColor: 'var(--color-text-muted)',
  overlayBg: { className: '', style: { background: 'rgba(248,250,252,0.96)', backdropFilter: 'blur(8px)' } },
  panel: { className: '', style: { background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.12)' } },
  sessionBg: { className: '', style: { background: '#f8fafc', minHeight: '100dvh' } },
  header: { className: '', style: { background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' } },
  headerTitle: { className: '', style: { color: 'var(--color-app-blue)' } },
  progressBar: { className: '', style: { background: 'rgba(255,255,255,0.7)', borderBottom: '1px solid #eef2f6' } },
  actionBar: { className: '', style: { background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e2e8f0', boxShadow: '0 -2px 12px rgba(0,0,0,0.05)' } },
  closeBtn: { className: '', style: { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' } },
  emptyBtn: { className: '', style: { background: 'var(--color-app-blue)', color: '#ffffff', border: 'none' } },
  primaryBtn: { className: '', style: { background: 'var(--color-app-blue)', border: 'none', color: '#ffffff' } },
  secondaryBtn: { className: '', style: { background: '#f1f5f9', border: '1.5px solid #e2e8f0', color: '#64748b' } },
  chip: { className: '', style: { background: 'var(--color-app-blue-light)', color: 'var(--color-app-blue-dark)', border: '1px solid #bfdbfe' } },
  linkClassName: 'text-app-blue no-underline hover:text-app-blue-dark transition-colors',
  depthDivider: false,
  starColor: 'blue',
  badgeStyle: mathBadgeStyle,
  masteryLabel: getMasteryLabel,
  formatDate,
}

export const FAVORITES_SKIN: PracticeSkin = {
  ...MATH_SKIN,
  sessionTitle: '收藏连刷',
  progressLabel: '收藏练习',
  hintText: (n, total) =>
    total !== undefined ? `全收藏夹 ${total} 题 · ${n} 题未练` : `全收藏夹 · ${n} 题未练`,
}

// ── Single-problem renderer ──────────────────────────────────────────────────────

function PracticeProblem({
  sp,
  solveCount,
  solvedAt,
  onSolve,
  skin,
}: {
  sp: SeaProblem
  solveCount: Record<string, number>
  solvedAt: Record<string, string>
  onSolve: (id: string) => Promise<number>
  skin: PracticeSkin
}) {
  const { problem, lessonId, section } = sp
  const lesson = SEA_LESSON_MAP[lessonId]
  const count = solveCount[problem.id] ?? 0
  const tagStyle = lesson?.tagStyle?.[problem.tag] ?? 'bg-gray-100 text-gray-600'
  const interactive = isInteractiveProblem(problem)
  const { awardStars } = useStarHud()

  const awardSeaStar = useCallback((origin?: HTMLElement) => {
    const rect = origin?.getBoundingClientRect()
    void awardStars(
      'blue',
      1,
      rect ? { origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } } : undefined,
    )
  }, [awardStars])

  const { answer, setAnswer, feedback, submit, check, clearFeedback } = useProblemAnswer(
    problem,
    {
      handleSolve: (id) => {
        void onSolve(id)
      },
      addWrong: () => {},
    },
    {
      onCorrect: () => {
        if (interactive) awardSeaStar()
      },
    },
  )

  const figure = useMemo(
    () =>
      interactive
        ? injectFigureGridCallbacks(problem.figureNode, {
            onSubmit: submit,
            onStateChange: clearFeedback,
          })
        : problem.figureNode,
    [interactive, problem.figureNode, submit, clearFeedback],
  )

  const displayFeedback = feedback
    ? {
        ok: feedback.ok,
        text: feedback.ok ? '🎉 完全正确！+1 ☀️ 蓝太阳' : feedback.message,
      }
    : null

  function checkAnswer(e?: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) {
    const result = check()
    if (result.ok && !interactive) {
      const target = e && 'currentTarget' in e ? (e.currentTarget as HTMLElement) : undefined
      awardSeaStar(target)
    }
  }

  const question = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tagStyle}`}>
          {problem.tagLabel}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lesson?.badgeClass ?? 'bg-gray-100 text-gray-600'}`}>
          {lesson?.icon} {lesson?.shortTitle}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
          {SOURCE_LABELS[section] ?? section}
        </span>
      </div>
      <div
        className="mb-3.5 rounded-lg border-l-4 border-cyan-300 bg-cyan-50/60 px-3.5 py-3 text-sm leading-relaxed text-slate-700 [&>strong]:font-bold [&>strong]:text-slate-900"
        dangerouslySetInnerHTML={{ __html: problem.text }}
      />
      {figure && <div>{figure}</div>}
      {interactive && displayFeedback?.text && (
        <div className={`text-[13px] font-medium ${displayFeedback.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
          {displayFeedback.text}
        </div>
      )}
    </div>
  )

  const solution = <ProblemSolutionPanel problem={problem} variant="amber" />

  const masteryRow = (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span style={skin.badgeStyle(count)} className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
        {skin.masteryLabel(count)}
      </span>
      <span>练过 {count} 次</span>
      {solvedAt[problem.id] && <span>· 上次 {skin.formatDate(solvedAt[problem.id])}</span>}
      <div className="ml-auto flex items-center gap-1">
        <FavoriteHeart problemId={problem.id} size="sm" />
        <Link href={sp.href} className={skin.linkClassName}>
          查看原题 →
        </Link>
      </div>
    </div>
  )

  const answerDom = interactive ? (
    masteryRow
  ) : (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <div className="whitespace-nowrap text-xs font-semibold text-gray-400">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3.5">
        <div className="text-[13px] text-gray-600">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            className="w-[72px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-800 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            placeholder="？"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkAnswer(e)}
          />
          <span className="text-gray-600">{problem.finalUnit}</span>
          <button
            onClick={e => checkAnswer(e)}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #0891b2, #0284c7)', boxShadow: '0 3px 10px rgba(8,145,178,0.35)' }}
          >
            检查答案
          </button>
        </div>
        {displayFeedback && (
          <div className={`mt-2 text-[13px] font-medium ${displayFeedback.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
            {displayFeedback.text}
          </div>
        )}
      </div>
      {masteryRow}
    </>
  )

  return (
    <div className="practice-overlay-enter">
      <div className="mb-3 text-[15px] font-bold text-gray-800">{problem.title}</div>
      <QuestionLayout question={question} solution={solution} answer={answerDom} />
    </div>
  )
}

/** 收藏连刷：按收藏列表顺序选题，进度为当前题号 / 收藏总数。 */
function initialFavoritesIndex(pool: SeaProblem[], solveCount: Record<string, number>): number {
  if (pool.length === 0) return 0
  const firstUntried = pool.findIndex((sp) => (solveCount[sp.problem.id] ?? 0) === 0)
  return firstUntried >= 0 ? firstUntried : 0
}

function FavoritesPoolProgress({
  current,
  total,
  label,
}: {
  current: number
  total: number
  label: string
}) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-rose-600">{label}</span>
        <span className="font-fredoka text-[12px] font-black tabular-nums text-rose-600">
          {current}
          <span className="text-[10px] opacity-60">/{total}</span>
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-rose-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Session ───────────────────────────────────────────────────────────────────────

export default function ProblemPracticeSession({
  pool,
  poolMode = 'sea',
  solveCount,
  solvedAt,
  onSolve,
  onEnd,
  skin,
}: {
  pool: SeaProblem[]
  poolMode?: 'sea' | 'favorites'
  solveCount: Record<string, number>
  solvedAt: Record<string, string>
  onSolve: (id: string) => Promise<number>
  onEnd: () => void
  skin: PracticeSkin
}): ReactNode {
  const isFavorites = poolMode === 'favorites'

  const pickNextSea = useCallback(
    (excludeProblemId?: string) => pickFromFilteredPool(pool, solveCount, excludeProblemId),
    [pool, solveCount],
  )

  const [seaCurrent, setSeaCurrent] = useState<SeaProblem | null>(() =>
    isFavorites ? null : pickFromFilteredPool(pool, solveCount),
  )
  const [favoritesIndex, setFavoritesIndex] = useState(() =>
    initialFavoritesIndex(pool, solveCount),
  )
  const [count, setCount] = useState(0)

  const current = isFavorites ? (pool[favoritesIndex] ?? null) : seaCurrent
  const canGoPrev = isFavorites && favoritesIndex > 0

  function nextProblem() {
    if (isFavorites) {
      if (pool.length === 0) return
      setFavoritesIndex((i) => (i + 1) % pool.length)
      setCount((c) => c + 1)
      return
    }
    setSeaCurrent(pickNextSea(current?.problem.id))
    setCount((c) => c + 1)
  }

  function prevProblem() {
    if (!canGoPrev) return
    setFavoritesIndex((i) => i - 1)
  }

  if (!current) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${skin.overlayBg.className ?? ''}`}
        style={skin.overlayBg.style}
      >
        <div
          className={`practice-overlay-enter mx-4 rounded-3xl p-10 text-center ${skin.panel.className ?? ''}`}
          style={skin.panel.style}
        >
          <div className="mb-3 text-5xl">{skin.emptyIcon}</div>
          <div className="text-lg font-bold" style={{ color: skin.titleColor }}>{skin.emptyTitle}</div>
          <div className="mt-1 text-sm" style={{ color: skin.bodyColor }}>{skin.emptySubtitle}</div>
          <button
            onClick={onEnd}
            className={`mt-6 cursor-pointer rounded-full border-none px-6 py-2.5 text-sm font-bold ${skin.emptyBtn.className ?? ''}`}
            style={skin.emptyBtn.style}
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  const untriedCount = pool.filter(sp => (solveCount[sp.problem.id] ?? 0) === 0).length

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${skin.sessionBg.className ?? ''}`}
      style={skin.sessionBg.style}
    >
      {/* Decorative particles — ocean-only */}
      {skin.particles && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {skin.particles.map(p => (
            <div
              key={p.id}
              className="absolute bottom-0 rounded-full"
              style={{
                left: p.x,
                width: p.size,
                height: p.size,
                background: 'rgba(0,229,255,0.4)',
                animationName: p.alt ? 'drift-up-alt' : 'drift-up',
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div
        className={`relative z-10 flex shrink-0 items-center gap-3 px-4 py-3 ${skin.header.className ?? ''}`}
        style={skin.header.style}
      >
        <button
          onClick={onEnd}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none text-lg font-bold transition-all hover:scale-105 ${skin.closeBtn.className ?? ''}`}
          style={skin.closeBtn.style}
        >
          ×
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`text-[17px] font-extrabold tracking-wide ${skin.headerTitle.className ?? ''}`}
            style={skin.headerTitle.style}
          >
            {skin.sessionTitle}
          </span>
          {count > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${skin.chip.className ?? ''}`} style={skin.chip.style}>
              已做 {count} 题
            </span>
          )}
        </div>
        <span className="ml-auto text-[11px] font-medium" style={{ color: skin.mutedColor }}>
          {skin.hintText(untriedCount, pool.length)}
        </span>
      </div>

      {/* Session star progress */}
      <div
        className={`relative z-10 shrink-0 px-4 py-2 ${skin.progressBar.className ?? ''}`}
        style={skin.progressBar.style}
      >
        <div className="mx-auto max-w-[700px]">
          {isFavorites ? (
            <FavoritesPoolProgress
              current={favoritesIndex + 1}
              total={pool.length}
              label={skin.progressLabel}
            />
          ) : (
            <StarProgressBar color={skin.starColor} target={10} label={skin.progressLabel} compact />
          )}
        </div>
      </div>

      {/* Problem */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[700px]">
          {skin.depthDivider && (
            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 h-px" style={{ background: 'rgba(0,229,255,0.1)' }} />
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(0,229,255,0.35)' }}>
                ≋ surfaced problem ≋
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(0,229,255,0.1)' }} />
            </div>
          )}
          <PracticeProblem
            sp={current}
            solveCount={solveCount}
            solvedAt={solvedAt}
            onSolve={onSolve}
            skin={skin}
          />
        </div>
      </div>

      {/* Action bar — extra bottom padding for iOS home indicator */}
      <div
        className={`relative z-10 flex shrink-0 items-center gap-3 px-4 py-4 ${skin.actionBar.className ?? ''}`}
        style={{ ...skin.actionBar.style, paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onEnd}
          className={`cursor-pointer rounded-full px-5 py-3 text-[13px] font-semibold transition-all active:scale-95 hover:scale-105 ${skin.secondaryBtn.className ?? ''}`}
          style={skin.secondaryBtn.style}
        >
          结束
        </button>
        {isFavorites && (
          <button
            onClick={prevProblem}
            disabled={!canGoPrev}
            className={`min-w-[96px] cursor-pointer rounded-full px-4 py-3 text-[13px] font-semibold transition-all active:scale-95 ${
              canGoPrev
                ? `${skin.secondaryBtn.className ?? ''} hover:scale-105`
                : 'cursor-not-allowed bg-gray-100 text-gray-400'
            }`}
            style={canGoPrev ? skin.secondaryBtn.style : undefined}
          >
            ‹ 上一题
          </button>
        )}
        <button
          onClick={nextProblem}
          className={`flex-1 cursor-pointer rounded-full py-3 text-[14px] font-extrabold tracking-wide transition-all active:scale-95 hover:scale-[1.02] ${skin.primaryBtn.className ?? ''}`}
          style={skin.primaryBtn.style}
        >
          下一题 ›
        </button>
      </div>
    </div>
  )
}
