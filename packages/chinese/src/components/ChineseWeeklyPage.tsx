'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useChineseContext } from '../context/ChineseContext'
import {
  buildChineseRoadmap,
  listGradeSemesters,
  formatGradeSemester,
  gradeSemesterKey,
  type GradeSemester,
  type RoadmapNode,
} from '../utils/chinese-roadmap'

const CONTAINER_W = 300
const NODE_R = 30
const ROW_H = 108
const AMP = 92
const TOP_PAD = 48

interface Point {
  x: number
  y: number
}

function nodePoint(idx: number): Point {
  return {
    x: CONTAINER_W / 2 + AMP * Math.sin((idx * Math.PI) / 2),
    y: TOP_PAD + idx * ROW_H,
  }
}

/** Smooth serpentine path through the node centers using vertical control points. */
function pathThrough(points: Point[]): string {
  if (points.length === 0) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const midY = (prev.y + cur.y) / 2
    d += ` C ${prev.x.toFixed(1)} ${midY.toFixed(1)}, ${cur.x.toFixed(1)} ${midY.toFixed(1)}, ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`
  }
  return d
}

function nodeInner(node: RoadmapNode): string {
  if (node.state === 'completed') return '✓'
  if (node.state === 'locked') return '🔒'
  if (node.lessonKind === 'garden') return '园'
  return String(node.bookLessonNo ?? node.unitLessonNo ?? '·')
}

export default function ChineseWeeklyPage() {
  const router = useRouter()
  const { lessons, lessonGroups, masteryMap, isCharDataReady, isCharDataLoading, bookSlug } =
    useChineseContext()

  const [selectedGrade, setSelectedGrade] = useState<GradeSemester | null>(null)

  const gradeOptions = useMemo(() => listGradeSemesters(lessons), [lessons])

  // 默认停在「全局下一课」所在的年级册，让路线图打开即定位到当前进度
  const defaultGrade = useMemo<GradeSemester | null>(() => {
    if (gradeOptions.length === 0) return null
    if (!isCharDataReady) return gradeOptions[0]
    const global = buildChineseRoadmap(lessons, lessonGroups, masteryMap, bookSlug)
    const currentLesson = global.currentLessonKey
      ? lessons.find((l) => l.lessonKey === global.currentLessonKey)
      : undefined
    if (currentLesson) return { grade: currentLesson.grade, semester: currentLesson.semester }
    return gradeOptions[0]
  }, [gradeOptions, isCharDataReady, lessons, lessonGroups, masteryMap, bookSlug])

  const effectiveGrade = selectedGrade ?? defaultGrade

  const roadmap = useMemo(() => {
    if (!isCharDataReady || !effectiveGrade) return null
    const scoped = lessons.filter(
      (l) => l.grade === effectiveGrade.grade && l.semester === effectiveGrade.semester,
    )
    return buildChineseRoadmap(scoped, lessonGroups, masteryMap, bookSlug)
  }, [isCharDataReady, effectiveGrade, lessons, lessonGroups, masteryMap, bookSlug])

  const points = useMemo(
    () => (roadmap ? roadmap.nodes.map((_, idx) => nodePoint(idx)) : []),
    [roadmap],
  )

  const totalHeight = points.length ? points[points.length - 1].y + NODE_R + 56 : 0

  const basePath = useMemo(() => pathThrough(points), [points])
  const progressPath = useMemo(() => {
    if (!roadmap || points.length === 0) return ''
    const end = roadmap.currentIndex >= 0 ? roadmap.currentIndex : points.length - 1
    return pathThrough(points.slice(0, end + 1))
  }, [roadmap, points])

  const openLesson = useCallback(
    (node: RoadmapNode) => {
      if (node.state === 'locked') return
      const query = new URLSearchParams({ lessons: node.lessonKey })
      if (node.state === 'completed') query.set('review', '1')
      router.push(`/chinese/chars/practice?${query.toString()}`)
    },
    [router],
  )

  if (!isCharDataReady) {
    if (isCharDataLoading) {
      return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
    }
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        字库未就绪，无法生成学习路线。请先灌入 Supabase 字表数据。
      </p>
    )
  }

  if (!roadmap) {
    return <p className="p-6 text-center text-sm text-slate-500">加载中…</p>
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">闯关路线</h1>
        <p className="mt-1 text-sm text-slate-500">按课文顺序闯关 · 学完一课解锁下一课</p>
      </header>

      {gradeOptions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">年级</span>
          {gradeOptions.map((opt) => {
            const active =
              effectiveGrade?.grade === opt.grade && effectiveGrade?.semester === opt.semester
            return (
              <button
                key={gradeSemesterKey(opt.grade, opt.semester)}
                type="button"
                onClick={() => setSelectedGrade(opt)}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-bold transition',
                  active
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'border border-amber-200 bg-white text-amber-800 hover:border-amber-400',
                )}
              >
                {formatGradeSemester(opt.grade, opt.semester)}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
        <div className="text-sm font-bold text-amber-800">
          已完成 {roadmap.completedCount} / {roadmap.totalCount} 课
        </div>
        <div className="ml-auto h-2 w-28 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
            style={{
              width: `${
                roadmap.totalCount > 0
                  ? Math.round((roadmap.completedCount / roadmap.totalCount) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
          已完成
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
          进行中
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
          未解锁
        </span>
      </div>

      <div className="relative mx-auto mt-4" style={{ width: CONTAINER_W, height: totalHeight }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={CONTAINER_W}
          height={totalHeight}
          fill="none"
        >
          <path
            d={basePath}
            stroke="#fde68a"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={basePath}
            stroke="#fef3c7"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 20"
          />
          {progressPath && (
            <path
              d={progressPath}
              stroke="#34d399"
              strokeWidth={14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {roadmap.nodes.map((node, idx) => {
          const p = points[idx]
          const isLocked = node.state === 'locked'
          const isCurrent = node.state === 'current'
          const isCompleted = node.state === 'completed'
          return (
            <div
              key={node.lessonKey}
              className="absolute"
              style={{ left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_R * 2 }}
            >
              <button
                type="button"
                disabled={isLocked}
                onClick={() => openLesson(node)}
                aria-label={node.label}
                className={clsx(
                  'flex min-w-3 items-center justify-center rounded-full text-xl font-black shadow-md transition',
                  'h-[60px] w-[60px]',
                  isCompleted &&
                    'cursor-pointer bg-gradient-to-br from-emerald-400 to-emerald-500 text-white ring-2 ring-emerald-200 hover:brightness-105',
                  isCurrent &&
                    'animate-pulse cursor-pointer bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-4 ring-amber-300 hover:brightness-105',
                  isLocked &&
                    'cursor-not-allowed bg-slate-200 text-slate-400 ring-2 ring-slate-100',
                )}
              >
                {nodeInner(node)}
              </button>

              <div
                className="pointer-events-none absolute top-[64px] left-1/2 -translate-x-1/2 text-center"
                style={{ width: 132 }}
              >
                <p
                  className={clsx(
                    'truncate text-[11px] font-bold',
                    isLocked ? 'text-slate-400' : 'text-slate-700',
                  )}
                >
                  {node.label}
                </p>
                {isCurrent && (
                  <p className="text-[10px] font-semibold text-amber-600">
                    {node.status.correct}/{node.status.total} · 开始练习
                  </p>
                )}
                {isCompleted && node.status.total > 0 && (
                  <p className="text-[10px] font-semibold text-emerald-600">已通关 · 复习</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
