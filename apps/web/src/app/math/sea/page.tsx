'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { SEA_POOL, SEA_LESSONS, SEA_LESSON_MAP, type SeaProblem } from '@rosie/math/utils/sea-data'
import { SOURCE_LABELS } from '@rosie/core'
import { getMasteryLevel } from '@rosie/core'
import {
  ALL_DIFFICULTY_LEVELS,
  DIFFICULTY_FILTER_BTNS,
  allDifficultiesSelected,
  type ProblemDifficulty,
} from '@rosie/core'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import ProblemPracticeSession, {
  SEA_SKIN,
  getBadgeStyle,
  getMasteryLabel,
  formatDate,
} from '@rosie/math/components/shared/ProblemPracticeSession'

// ── Ocean animation styles ─────────────────────────────────────────────────────

const OCEAN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

.sea-root {
  font-family: 'Outfit', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif;
}

@keyframes drift-up {
  0%   { transform: translateY(0) translateX(0) scale(1);    opacity: 0;   }
  10%  { opacity: 0.55; }
  90%  { opacity: 0.2; }
  100% { transform: translateY(-100vh) translateX(12px) scale(0.4); opacity: 0; }
}

@keyframes drift-up-alt {
  0%   { transform: translateY(0) translateX(0) scale(1);    opacity: 0;   }
  10%  { opacity: 0.4; }
  90%  { opacity: 0.15; }
  100% { transform: translateY(-100vh) translateX(-10px) scale(0.3); opacity: 0; }
}

@keyframes bio-pulse {
  0%, 100% { box-shadow: var(--pulse-shadow-lo); }
  50%       { box-shadow: var(--pulse-shadow-hi); }
}

@keyframes lure-glow {
  0%, 100% {
    box-shadow: 0 0 10px #00e5ff, 0 0 24px rgba(0,229,255,0.5), inset 0 0 12px rgba(0,229,255,0.15);
  }
  50% {
    box-shadow: 0 0 18px #00e5ff, 0 0 40px rgba(0,229,255,0.7), 0 0 60px rgba(0,212,180,0.3), inset 0 0 20px rgba(0,229,255,0.25);
  }
}

@keyframes wave-move {
  0%   { background-position-x: 0;    }
  100% { background-position-x: 180px; }
}

@keyframes surface-in {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0);    }
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}

@keyframes depth-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%);  }
}

.sea-card {
  animation: card-in 0.35s ease both;
}

.sea-card-mastered {
  --pulse-shadow-lo: 0 0 12px rgba(255,209,102,0.25), 0 2px 16px rgba(0,0,0,0.3);
  --pulse-shadow-hi: 0 0 28px rgba(255,209,102,0.45), 0 0 50px rgba(255,185,50,0.2), 0 2px 16px rgba(0,0,0,0.3);
  animation: bio-pulse 3s ease-in-out infinite, card-in 0.35s ease both;
}

.lure-btn {
  animation: lure-glow 2s ease-in-out infinite;
}

.sea-chip-on {
  background: rgba(0, 229, 255, 0.18) !important;
  border-color: rgba(0, 229, 255, 0.7) !important;
  color: #00e5ff !important;
  box-shadow: 0 0 8px rgba(0,229,255,0.2);
}

.sea-chip-off {
  background: rgba(255,255,255,0.04) !important;
  border-color: rgba(255,255,255,0.12) !important;
  color: rgba(180,210,235,0.7) !important;
}

.sea-chip-on:hover { background: rgba(0, 229, 255, 0.25) !important; }
.sea-chip-off:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(0,229,255,0.35) !important; }

.practice-overlay-enter {
  animation: surface-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
}

.sea-input {
  background: rgba(5, 27, 55, 0.8) !important;
  border: 1.5px solid rgba(0, 229, 255, 0.25) !important;
  color: #c8e6f5 !important;
  backdrop-filter: blur(8px);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.sea-input:focus {
  border-color: rgba(0,229,255,0.65) !important;
  box-shadow: 0 0 0 3px rgba(0,229,255,0.1), 0 0 16px rgba(0,229,255,0.15) !important;
  outline: none !important;
}
.sea-input::placeholder { color: rgba(90,142,176,0.6) !important; }

.sea-filter-panel {
  background: rgba(5, 22, 48, 0.72);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 229, 255, 0.15);
  box-shadow: 0 4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,229,255,0.08);
}

.sea-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(0,229,255,0.5);
}

.scroll-glow {
  position: relative;
  overflow-x: auto;
  scrollbar-width: none;
}
.scroll-glow::-webkit-scrollbar { display: none; }
`

// ── Ocean particle data ────────────────────────────────────────────────────────

const PARTICLES = [
  { id: 1,  x: '4%',  size: 4, dur: 20, delay: -3,  alt: false },
  { id: 2,  x: '11%', size: 7, dur: 25, delay: -9,  alt: true  },
  { id: 3,  x: '19%', size: 3, dur: 16, delay: -1,  alt: false },
  { id: 4,  x: '27%', size: 9, dur: 28, delay: -14, alt: true  },
  { id: 5,  x: '35%', size: 4, dur: 18, delay: -6,  alt: false },
  { id: 6,  x: '44%', size: 6, dur: 22, delay: -11, alt: true  },
  { id: 7,  x: '52%', size: 3, dur: 15, delay: -2,  alt: false },
  { id: 8,  x: '60%', size: 8, dur: 26, delay: -8,  alt: true  },
  { id: 9,  x: '68%', size: 4, dur: 19, delay: -17, alt: false },
  { id: 10, x: '76%', size: 6, dur: 23, delay: -5,  alt: true  },
  { id: 11, x: '84%', size: 3, dur: 17, delay: -13, alt: false },
  { id: 12, x: '92%', size: 5, dur: 21, delay: -7,  alt: true  },
]

// ── Mastery glow helpers ──────────────────────────────────────────────────────

function getCardStyle(count: number): React.CSSProperties {
  const base: React.CSSProperties = {
    background: 'rgba(5, 27, 55, 0.82)',
    backdropFilter: 'blur(10px)',
  }
  if (count === 0) return { ...base, border: '1.5px solid rgba(0,229,255,0.10)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }
  if (count === 1) return { ...base, border: '1.5px solid rgba(0,212,180,0.45)', boxShadow: '0 0 14px rgba(0,212,180,0.12), 0 2px 12px rgba(0,0,0,0.25)' }
  if (count === 2) return { ...base, border: '1.5px solid rgba(0,229,255,0.75)', boxShadow: '0 0 20px rgba(0,229,255,0.22), 0 2px 12px rgba(0,0,0,0.25)' }
  return { ...base, border: '1.5px solid rgba(255,209,102,0.82)', boxShadow: '0 0 24px rgba(255,209,102,0.28), 0 0 50px rgba(255,185,50,0.12), 0 2px 12px rgba(0,0,0,0.25)' }
}

// ── Paginated problem grid ────────────────────────────────────────────────────

function SeaGrid({
  items,
  page,
  pageSize,
  solveCount,
  solvedAt,
  onPageChange,
}: {
  items: SeaProblem[]
  page: number
  pageSize: number
  solveCount: Record<string, number>
  solvedAt: Record<string, string>
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize)

  // Build page number list with ellipsis
  function getPageNums(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const nums: (number | '…')[] = [1]
    if (page > 3) nums.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i)
    if (page < totalPages - 2) nums.push('…')
    nums.push(totalPages)
    return nums
  }

  return (
    <>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {pageItems.map((sp, idx) => {
          const { problem, lessonId, section } = sp
          const lesson = SEA_LESSON_MAP[lessonId]
          const count = solveCount[problem.id] ?? 0
          const level = getMasteryLevel(count)
          const tagStyle = lesson?.tagStyle?.[problem.tag] ?? 'bg-gray-100 text-gray-600'
          const lastSolved = solvedAt[problem.id]
          const cardStyle = getCardStyle(count)

          return (
            <Link
              key={`${lessonId}-${section}-${problem.id}`}
              href={sp.href}
              className={`sea-card group flex items-start gap-3 rounded-[14px] p-3 no-underline transition-all duration-200 hover:-translate-y-0.5 ${level >= 3 ? 'sea-card-mastered' : ''}`}
              style={{ ...cardStyle, animationDelay: `${Math.min(idx * 0.04, 0.5)}s` }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={getBadgeStyle(count)}
              >
                {getMasteryLabel(count)}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="mb-1 text-[13px] font-semibold leading-tight"
                  style={{ color: count >= 3 ? '#ffd166' : count >= 1 ? '#c8e6f5' : 'rgba(180,210,235,0.75)' }}
                >
                  {problem.title}
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${tagStyle}`}>
                    {problem.tagLabel}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-px text-[9px] font-semibold"
                    style={{ background: 'rgba(0,229,255,0.08)', color: 'rgba(0,229,255,0.65)', border: '1px solid rgba(0,229,255,0.15)' }}
                  >
                    {lesson?.icon} {lesson?.shortTitle}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-px text-[9px]"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(90,142,176,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {SOURCE_LABELS[section] ?? section}
                  </span>
                  <PracticeCountBadge count={count} />
                </div>
                {count > 0 && lastSolved && (
                  <div className="mt-1.5 text-[10px]" style={{ color: 'rgba(90,142,176,0.6)' }}>
                    上次 {formatDate(lastSolved)}
                  </div>
                )}
              </div>
              <FavoriteHeart problemId={problem.id} size="sm" />
              <span
                className="shrink-0 self-center text-[12px] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: count >= 3 ? 'rgba(255,209,102,0.7)' : 'rgba(0,229,255,0.5)' }}
              >
                →
              </span>
            </Link>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none text-[13px] transition-all disabled:opacity-30"
            style={{ background: 'rgba(0,229,255,0.07)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' }}
          >
            ‹
          </button>

          {getPageNums().map((n, i) =>
            n === '…' ? (
              <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-[11px]" style={{ color: 'rgba(90,142,176,0.5)' }}>
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPageChange(n)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none text-[12px] font-bold transition-all active:scale-95"
                style={
                  n === page
                    ? { background: 'rgba(0,229,255,0.18)', color: '#00e5ff', border: '1.5px solid rgba(0,229,255,0.65)', boxShadow: '0 0 8px rgba(0,229,255,0.2)' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(180,210,235,0.6)', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                {n}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none text-[13px] transition-all disabled:opacity-30"
            style={{ background: 'rgba(0,229,255,0.07)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' }}
          >
            ›
          </button>

          <span className="ml-2 text-[10px]" style={{ color: 'rgba(90,142,176,0.5)' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, items.length)} / {items.length}
          </span>
        </div>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type MasteryFilter = 'all' | 'unstarted' | 'reinforce' | 'mastered'

export default function MathSeaPage() {
  const { user } = useAuth()
  const { solveCount, solvedAt, handleSolve } = useMathSolved(user)
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const allTypeKeys = useMemo(
    () => new Set(SEA_LESSONS.flatMap(l => l.types.map(t => `${l.id}::${t.tag}`))),
    []
  )
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(() => {
    const param = searchParams.get('lessons')
    if (param) {
      const ids = param.split(',').filter(id => SEA_LESSONS.some(l => l.id === id))
      if (ids.length > 0) return new Set(ids)
    }
    return new Set(SEA_LESSONS.map(l => l.id))
  })
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
    const param = searchParams.get('lessons')
    if (param) {
      const ids = param.split(',').filter(id => SEA_LESSONS.some(l => l.id === id))
      if (ids.length > 0) {
        const types = new Set<string>()
        for (const id of ids) SEA_LESSON_MAP[id]?.types.forEach(t => types.add(`${id}::${t.tag}`))
        return types
      }
    }
    return new Set(SEA_LESSONS.flatMap(l => l.types.map(t => `${l.id}::${t.tag}`)))
  })
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(['pretest', 'lesson', 'homework', 'workbook', 'supplement'])
  )
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('all')
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<ProblemDifficulty>>(
    () => new Set(ALL_DIFFICULTY_LEVELS),
  )
  const [practiceMode, setPracticeMode] = useState(false)
  const [filterOpen, setFilterOpen] = useState(() => !searchParams.get('lessons'))
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const availableTypes = useMemo(() => {
    const seen = new Set<string>()
    const result: { tag: string; label: string; lessonId: string }[] = []
    for (const lesson of SEA_LESSONS) {
      if (!selectedLessons.has(lesson.id)) continue
      for (const t of lesson.types) {
        const key = `${lesson.id}::${t.tag}`
        if (!seen.has(key)) { seen.add(key); result.push({ tag: t.tag, label: t.label, lessonId: lesson.id }) }
      }
    }
    return result
  }, [selectedLessons])

  const toggleLesson = useCallback((id: string) => {
    setPage(1)
    setSelectedLessons(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setSelectedTypes(pt => {
          const t = new Set(pt)
          SEA_LESSON_MAP[id]?.types.forEach(tp => t.delete(`${id}::${tp.tag}`))
          return t
        })
      } else {
        next.add(id)
        setSelectedTypes(pt => {
          const t = new Set(pt)
          SEA_LESSON_MAP[id]?.types.forEach(tp => t.add(`${id}::${tp.tag}`))
          return t
        })
      }
      return next
    })
  }, [])

  const toggleType = useCallback((key: string) => {
    setPage(1)
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const toggleSection = useCallback((sec: string) => {
    setPage(1)
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (next.has(sec)) next.delete(sec); else next.add(sec)
      return next
    })
  }, [])

  const allLessonsSelected = selectedLessons.size === SEA_LESSONS.length
  const allSectionsSelected = selectedSections.size === 5
  const allTypesSelected = availableTypes.length > 0 && availableTypes.every(t => selectedTypes.has(`${t.lessonId}::${t.tag}`))
  const allDifficultySelected = allDifficultiesSelected(selectedDifficulties)

  const toggleAllLessons = useCallback(() => {
    setPage(1)
    if (allLessonsSelected) {
      setSelectedLessons(new Set())
      setSelectedTypes(new Set())
    } else {
      setSelectedLessons(new Set(SEA_LESSONS.map(l => l.id)))
      setSelectedTypes(allTypeKeys)
    }
  }, [allLessonsSelected, allTypeKeys])

  const toggleAllSections = useCallback((sectionKeys: string[]) => {
    setPage(1)
    if (allSectionsSelected) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(sectionKeys))
    }
  }, [allSectionsSelected])

  const toggleAllTypes = useCallback(() => {
    setPage(1)
    if (allTypesSelected) {
      setSelectedTypes(new Set())
    } else {
      setSelectedTypes(new Set(availableTypes.map(t => `${t.lessonId}::${t.tag}`)))
    }
  }, [allTypesSelected, availableTypes])

  const toggleDifficulty = useCallback((level: ProblemDifficulty) => {
    setPage(1)
    setSelectedDifficulties(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }, [])

  const toggleAllDifficulties = useCallback(() => {
    setPage(1)
    if (allDifficultySelected) {
      setSelectedDifficulties(new Set())
    } else {
      setSelectedDifficulties(new Set(ALL_DIFFICULTY_LEVELS))
    }
  }, [allDifficultySelected])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return SEA_POOL.filter(sp => {
      if (!selectedLessons.has(sp.lessonId)) return false
      if (!selectedSections.has(sp.section)) return false
      if (selectedTypes.size > 0 && !selectedTypes.has(`${sp.lessonId}::${sp.problem.tag}`)) return false
      if (!selectedDifficulties.has(sp.problem.difficulty)) return false
      const c = solveCount[sp.problem.id] ?? 0
      if (masteryFilter === 'unstarted' && c > 0) return false
      if (masteryFilter === 'reinforce' && (c === 0 || c >= 3)) return false
      if (masteryFilter === 'mastered' && c < 3) return false
      if (q) {
        const hay = `${sp.problem.title} ${sp.problem.text} ${sp.problem.tagLabel}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [search, selectedLessons, selectedSections, selectedTypes, selectedDifficulties, masteryFilter, solveCount])

  const stats = useMemo(() => {
    const total = filtered.length
    const attempted = filtered.filter(sp => (solveCount[sp.problem.id] ?? 0) > 0).length
    const mastered = filtered.filter(sp => (solveCount[sp.problem.id] ?? 0) >= 3).length
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
    return { total, attempted, mastered, pct }
  }, [filtered, solveCount])

  const SECTION_BTNS = [
    { key: 'pretest', label: '📝 课前测' },
    { key: 'lesson', label: '📖 课堂' },
    { key: 'homework', label: '✏️ 课后' },
    { key: 'workbook', label: '📚 练习册' },
    { key: 'supplement', label: '📒 附加题' },
  ]

  const MASTERY_BTNS: { key: MasteryFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'unstarted', label: '⬛ 未做' },
    { key: 'reinforce', label: '🌱 需巩固' },
    { key: 'mastered', label: '🦋 已掌握' },
  ]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OCEAN_CSS }} />

      {practiceMode && (
        <ProblemPracticeSession
          pool={filtered}
          solveCount={solveCount}
          solvedAt={solvedAt}
          onSolve={handleSolve}
          onEnd={() => setPracticeMode(false)}
          skin={SEA_SKIN}
        />
      )}

      <div
        className="sea-root relative min-h-screen"
        style={{ background: 'linear-gradient(180deg, #020c1e 0%, #031425 40%, #041a35 70%, #051e3e 100%)' }}
      >
        {/* ── Background particles ── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {PARTICLES.map(p => (
            <div
              key={p.id}
              className="absolute bottom-0 rounded-full"
              style={{
                left: p.x,
                width: p.size,
                height: p.size,
                background: 'radial-gradient(circle, rgba(0,229,255,0.7) 0%, rgba(0,212,180,0.3) 100%)',
                animationName: p.alt ? 'drift-up-alt' : 'drift-up',
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            />
          ))}
          {/* Deep ocean subtle radial */}
          <div
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,30,70,0.6) 0%, transparent 70%)', filter: 'blur(40px)' }}
          />
        </div>

        {/* ── Sticky Header ── */}
        <div
          className="sticky top-0 z-30"
          style={{
            background: 'rgba(2,12,30,0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,229,255,0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div className="mx-auto flex h-14 max-w-350 items-center gap-3 px-4">
            <Link
              href="/math"
              className="flex h-9 items-center gap-1.5 rounded-full px-3 no-underline transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.22)', color: 'rgba(0,229,255,0.8)' }}
            >
              <span className="text-[13px] font-bold">←</span>
              <span className="hidden text-[11px] font-semibold sm:inline">返回</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <span
                className="text-[22px] font-black tracking-tighter"
                style={{ color: '#00e5ff', textShadow: '0 0 16px rgba(0,229,255,0.6), 0 0 32px rgba(0,229,255,0.3)', fontFamily: "'Outfit', sans-serif" }}
              >
                题海
              </span>
              <span
                className="hidden text-[11px] font-semibold tracking-widest uppercase sm:block"
                style={{ color: 'rgba(0,229,255,0.45)', letterSpacing: '0.15em' }}
              >
                · Problem Sea
              </span>
            </div>

          </div>
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 mx-auto max-w-350 px-4 pb-8 pt-4">

          {/* Search */}
          <div className="relative mb-3">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'rgba(0,229,255,0.45)' }}
            >
              ≋
            </span>
            <input
              type="text"
              placeholder="搜索题目 · 关键字 · 题型…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="sea-input w-full rounded-2xl pl-9 pr-4 py-3 text-[13px]"
            />
          </div>

          {/* Filter panel */}
          <div className="sea-filter-panel mb-3 rounded-2xl overflow-hidden">
            {/* Panel header */}
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition-all"
              style={{ background: 'none', border: 'none' }}
            >
              <span className="sea-section-label">筛选器</span>
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(0,229,255,0.1)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  {selectedLessons.size}/{SEA_LESSONS.length} 课程
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(0,229,255,0.1)', color: 'rgba(0,229,255,0.7)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  {selectedSections.size}/5 来源
                </span>
                {!allDifficultySelected && (
                  <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(255,209,102,0.1)', color: 'rgba(255,209,102,0.8)', border: '1px solid rgba(255,209,102,0.25)' }}>
                    难度 {selectedDifficulties.size}/5
                  </span>
                )}
                {masteryFilter !== 'all' && (
                  <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'rgba(255,209,102,0.1)', color: 'rgba(255,209,102,0.8)', border: '1px solid rgba(255,209,102,0.25)' }}>
                    {MASTERY_BTNS.find(b => b.key === masteryFilter)?.label}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[11px] transition-transform duration-200" style={{ color: 'rgba(0,229,255,0.4)', transform: filterOpen ? 'rotate(180deg)' : undefined }}>▾</span>
            </button>

            {filterOpen && (
              <div className="px-4 pb-4 pt-1 space-y-4" style={{ borderTop: '1px solid rgba(0,229,255,0.08)' }}>

                {/* Lesson filter */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="sea-section-label">课程</span>
                    <button onClick={toggleAllLessons} className="cursor-pointer text-[10px] transition-colors" style={{ color: 'rgba(0,229,255,0.5)' }}>{allLessonsSelected ? '全不选' : '全选'}</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...SEA_LESSONS].sort((a, b) => Number(b.id) - Number(a.id)).map(l => (
                      <button
                        key={l.id}
                        onClick={() => toggleLesson(l.id)}
                        className={`sea-chip-${selectedLessons.has(l.id) ? 'on' : 'off'} cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95`}
                      >
                        {l.icon} {l.shortTitle}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type filter */}
                {availableTypes.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="sea-section-label">题型</span>
                      <button onClick={toggleAllTypes} className="cursor-pointer text-[10px] transition-colors" style={{ color: 'rgba(0,229,255,0.5)' }}>{allTypesSelected ? '全不选' : '全选'}</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTypes.map(t => {
                        const key = `${t.lessonId}::${t.tag}`
                        return (
                          <button
                            key={key}
                            onClick={() => toggleType(key)}
                            className={`sea-chip-${selectedTypes.has(key) ? 'on' : 'off'} cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95`}
                            title={`${SEA_LESSON_MAP[t.lessonId]?.shortTitle} · ${t.label}`}
                          >
                            {t.label.split('·').slice(-1)[0].trim()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Difficulty filter */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="sea-section-label">难度</span>
                    <button
                      type="button"
                      onClick={toggleAllDifficulties}
                      className="cursor-pointer text-[10px] transition-colors"
                      style={{ color: 'rgba(0,229,255,0.5)' }}
                    >
                      {allDifficultySelected ? '全不选' : '全选'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFFICULTY_FILTER_BTNS.map(b => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => toggleDifficulty(b.key)}
                        className={`sea-chip-${selectedDifficulties.has(b.key) ? 'on' : 'off'} cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section + Mastery in 2 cols */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="sea-section-label">来源</span>
                      <button onClick={() => toggleAllSections(SECTION_BTNS.map(b => b.key))} className="cursor-pointer text-[10px] transition-colors" style={{ color: 'rgba(0,229,255,0.5)' }}>{allSectionsSelected ? '全不选' : '全选'}</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SECTION_BTNS.map(b => (
                        <button
                          key={b.key}
                          onClick={() => toggleSection(b.key)}
                          className={`sea-chip-${selectedSections.has(b.key) ? 'on' : 'off'} cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="sea-section-label mb-2">掌握度</div>
                    <div className="flex flex-wrap gap-1.5">
                      {MASTERY_BTNS.map(b => (
                        <button
                          key={b.key}
                          onClick={() => { setMasteryFilter(b.key); setPage(1) }}
                          className={`sea-chip-${masteryFilter === b.key ? 'on' : 'off'} cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats bar + random practice */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid rgba(0,229,255,0.08)', background: 'rgba(0,229,255,0.03)' }}
            >
              {/* Depth meter */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(90,142,176,0.8)' }}>
                  <span>共 <strong style={{ color: '#c8e6f5' }}>{stats.total}</strong> 题</span>
                  <span>·</span>
                  <span>练过 <strong style={{ color: '#00d4b4' }}>{stats.attempted}</strong></span>
                  <span>·</span>
                  <span>掌握 <strong style={{ color: '#ffd166' }}>{stats.mastered}</strong></span>
                </div>
                <div className="relative h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(0,229,255,0.08)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${stats.total > 0 ? Math.round((stats.attempted / stats.total) * 100) : 0}%`, background: 'rgba(0,212,180,0.5)' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{ width: `${stats.pct}%`, background: 'linear-gradient(90deg, #00d4b4, #ffd166)' }}
                  />
                  {/* shimmer */}
                  <div
                    className="absolute inset-y-0 w-16 rounded-full opacity-40"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)', animation: 'depth-shimmer 2.5s linear infinite' }}
                  />
                </div>
              </div>

              {/* Random practice button */}
              <button
                onClick={() => filtered.length > 0 && setPracticeMode(true)}
                disabled={filtered.length === 0}
                className="lure-btn shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-[12px] font-extrabold tracking-wide transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(0,229,255,0.08)',
                  border: '1.5px solid rgba(0,229,255,0.6)',
                  color: '#00e5ff',
                  letterSpacing: '0.06em',
                }}
              >
                随机练 ≋
              </button>
            </div>
          </div>

          {/* ── Problem grid ── */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mb-3 text-5xl opacity-30">🌊</div>
              <div className="text-[14px] font-medium" style={{ color: 'rgba(90,142,176,0.6)' }}>
                深海中没有符合条件的题目
              </div>
              <div className="mt-1 text-[12px]" style={{ color: 'rgba(90,142,176,0.4)' }}>
                调整筛选条件，继续探索
              </div>
            </div>
          ) : (
            <SeaGrid
              items={filtered}
              page={Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))}
              pageSize={PAGE_SIZE}
              solveCount={solveCount}
              solvedAt={solvedAt}
              onPageChange={setPage}
            />
          )}

          <div className="h-8" />
        </div>
      </div>
    </>
  )
}
