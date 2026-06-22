'use client'

import { useState } from 'react'
import Link from 'next/link'
import OrbBackground from '@/components/shared/OrbBackground'
import BackLink from '@/components/shared/BackLink'
import { useAuth } from '@/contexts/AuthContext'
import { useMathSolved } from '@/hooks/useMathSolved'
import { useMathWrong } from '@/hooks/useMathWrong'
import { getMasteryLevel, MASTERY_BORDER, MASTERY_BADGE_BG, MASTERY_ICON } from '@/utils/masteryUtils'
import { SOURCE_LABELS } from '@/utils/constant'
import { PROBLEMS as P34, TAG_STYLE as TS34 } from '@/utils/lesson34-data'
import { PROBLEMS as P35, TAG_STYLE as TS35 } from '@/utils/lesson35-data'
import { PROBLEMS as P36, TAG_STYLE as TS36 } from '@/utils/lesson36-data'
import { PROBLEMS as P37, TAG_STYLE as TS37 } from '@/utils/lesson37-data'
import { PROBLEMS as P38, TAG_STYLE as TS38 } from '@/utils/lesson38-data'
import { PROBLEMS as P39, TAG_STYLE as TS39 } from '@/utils/lesson39-data'
import type { Problem, ProblemSet } from '@/utils/type'

// ── Data setup ─────────────────────────────────────────────────────────────────

type SectionKey = 'pretest' | 'lesson' | 'homework' | 'workbook' | 'supplement'
const ALL_SECTIONS: SectionKey[] = ['lesson', 'homework', 'workbook', 'supplement', 'pretest']

type ProblemEntry = {
  problem: Problem
  lessonId: string
  section: SectionKey
  idx: number  // 1-based index within section
}

const LESSON_META: Array<{
  id: string
  name: string
  data: ProblemSet
  tagStyle: Record<string, string>
}> = [
  { id: '34', name: '乘法分配律', data: P34, tagStyle: TS34 },
  { id: '35', name: '归一问题',   data: P35, tagStyle: TS35 },
  { id: '36', name: '星期几问题', data: P36, tagStyle: TS36 },
  { id: '37', name: '鸡兔同笼',   data: P37, tagStyle: TS37 },
  { id: '38', name: '一笔画',     data: P38, tagStyle: TS38 },
  { id: '39', name: '盈亏问题',   data: P39, tagStyle: TS39 },
]

const PROBLEM_MAP = (() => {
  const map = new Map<string, ProblemEntry>()
  for (const { id, data } of LESSON_META) {
    for (const section of ALL_SECTIONS) {
      const problems = data[section]
      if (!problems) continue
      problems.forEach((p, i) => map.set(p.id, { problem: p, lessonId: id, section, idx: i + 1 }))
    }
  }
  return map
})()

function getLessonTagStyle(lessonId: string) {
  return LESSON_META.find(l => l.id === lessonId)?.tagStyle ?? {}
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GlobalMistakesPage() {
  const { user } = useAuth()
  const { solveCount } = useMathSolved(user)
  const { wrongIds, removeWrong } = useMathWrong(user)

  const [filterLesson, setFilterLesson] = useState<string>('all')

  // Build wrong list from all lessons
  const wrongList = [...wrongIds]
    .map(id => PROBLEM_MAP.get(id))
    .filter((e): e is ProblemEntry => e != null)
    .filter(e => filterLesson === 'all' || e.lessonId === filterLesson)

  const masteredCount = wrongList.filter(({ problem }) => (solveCount[problem.id] ?? 0) >= 3).length

  return (
    <>
      <OrbBackground variant="math" />
      <BackLink />

      <div className="relative z-1 flex min-h-screen flex-col items-start px-4 py-8 max-w-[680px] mx-auto">
        {/* Header card */}
        <div className="w-full mb-4 rounded-[14px] border border-[#fecaca] bg-gradient-to-br from-[#fff5f5] to-[#fee2e2] p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#991b1b]">
            📕 错题本
            {wrongIds.size > 0 && (
              <span className="rounded-full bg-[#fca5a5] px-2 py-0.5 text-[11px] font-bold text-[#7f1d1d]">
                {wrongIds.size} 题
              </span>
            )}
          </div>
          <div className="mb-2 text-xs text-[#b91c1c]">
            汇总所有课程的错题 · 答对后自动移除
          </div>
          {wrongIds.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-[#fecaca]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#f87171] transition-[width] duration-500"
                  style={{ width: `${Math.round((masteredCount / wrongIds.size) * 100)}%` }}
                />
              </div>
              <div className="shrink-0 text-[11px] font-bold text-[#991b1b]">
                已改正 {masteredCount}/{wrongIds.size}
              </div>
            </div>
          )}
        </div>

        {/* Lesson filter */}
        <div className="w-full mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterLesson('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filterLesson === 'all' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全部
          </button>
          {LESSON_META.map(({ id, name }) => (
            <button
              key={id}
              onClick={() => setFilterLesson(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                filterLesson === id ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              第{id}讲 · {name}
            </button>
          ))}
        </div>

        {/* Problem list */}
        {wrongList.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="text-5xl">🎉</div>
            <div className="text-[15px] font-bold text-text-primary">
              {filterLesson === 'all' ? '错题本是空的！' : '该课没有错题！'}
            </div>
            <div className="text-[13px] text-text-muted">答错的题目会自动出现在这里</div>
            <Link
              href="/math"
              className="mt-2 rounded-full bg-app-blue px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(59,130,246,0.3)]"
            >
              去做题 →
            </Link>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-2">
            {wrongList.map(({ problem, lessonId, section, idx }) => {
              const count = solveCount[problem.id] ?? 0
              const level = getMasteryLevel(count)
              const isMastered = count >= 3
              const srcLabel = SOURCE_LABELS[section] || section
              const tagStyle = getLessonTagStyle(lessonId)
              const href = `/math/ny/${lessonId}/${section}/${idx}`

              return (
                <div
                  key={problem.id}
                  className={`flex items-center gap-3 rounded-[12px] border-[1.5px] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow ${
                    isMastered ? 'border-app-green opacity-70' : `border-[#fca5a5] ${MASTERY_BORDER[level]}`
                  }`}
                >
                  <div className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-sm ${MASTERY_BADGE_BG[level]}`}>
                    {MASTERY_ICON[level]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-text-primary">{problem.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <span className="rounded-full bg-indigo-50 px-2 py-px text-[10px] font-semibold text-indigo-600">
                        第{lessonId}讲
                      </span>
                      <span className={`rounded-full px-2 py-px text-[10px] font-semibold ${tagStyle[problem.tag] || 'bg-gray-100 text-gray-600'}`}>
                        {problem.tagLabel}
                      </span>
                      <span className="rounded-full bg-[#f3e8ff] px-2 py-px text-[10px] font-semibold text-[#7e22ce]">
                        {srcLabel}
                      </span>
                      {count > 0 && (
                        <span className="rounded-full bg-gray-100 px-2 py-px text-[10px] text-text-muted">
                          已练 {count} 次
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={href}
                      className="rounded-full bg-app-blue px-3 py-1.5 text-[11px] font-semibold text-white no-underline"
                    >
                      {isMastered ? '再练' : '去练'}
                    </Link>
                    <button
                      onClick={() => void removeWrong(problem.id)}
                      className="rounded-full border border-[#fca5a5] px-2 py-1.5 text-[11px] text-[#dc2626] transition-colors hover:bg-[#fee2e2]"
                      title="从错题本移除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
