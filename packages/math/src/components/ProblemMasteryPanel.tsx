'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MathPlanProblem, ProblemMasteryMap, ProblemSet, WordMasteryInfo } from '@rosie/core'
import { useAuth, ensureStageInit, isGraduated, MASTERY_ICON, getMasteryLevel } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import type { MathPracticeAttemptRow } from '@rosie/math-kit/hooks/math-scratch-types'
import { fetchPracticeAttemptsForProblems } from '@rosie/math-kit/utils/math-scratch-db'
import { attemptRowHasViewableCanvas, pickPracticeAttemptForRow } from '@rosie/math-kit/utils/math-practice-attempt'
import PracticeViewDraftButton from '@rosie/math/components/shared/practice-queue/PracticeViewDraftButton'
import { resolveMathPlanProblem } from '@rosie/math/utils/practice-queue-from-plan'
import { lessonDisplayLabel } from '@rosie/math-kit/utils/lesson-grade'

interface Props {
  problems: MathPlanProblem[]
  masteryMap: ProblemMasteryMap
  /** Needed to open the scratch-pad draft viewer. */
  problemSets?: Record<string, ProblemSet>
}

const PAGE_SIZE = 10

const SECTION_LABEL: Record<string, string> = {
  lesson: '课堂',
  homework: '课后',
  workbook: '练习册',
  pretest: '课前测',
  supplement: '附加',
}

function formatDue(nextReviewDate: string | undefined, today: string) {
  if (!nextReviewDate) return { label: '—', urgent: 'none' as const }
  const diff = Math.floor((Date.parse(nextReviewDate) - Date.parse(today)) / 86400000)
  const [, m, d] = nextReviewDate.split('-')
  const dateStr = `${Number(m)}/${Number(d)}`
  if (diff <= 0) return { label: `今天 (${dateStr})`, urgent: 'today' as const }
  if (diff === 1) return { label: `明天 (${dateStr})`, urgent: 'tomorrow' as const }
  return { label: `${diff}天后 (${dateStr})`, urgent: 'future' as const }
}

function formatPracticeTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [, m, day] = iso.split('-')
      return `${Number(m)}/${Number(day)}`
    }
    return iso
  }
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const hasTime = iso.includes('T') || iso.includes(':')
  return hasTime ? `${m}/${day} ${hh}:${mm}` : `${m}/${day}`
}

const DUE_STYLES: Record<string, string> = {
  today: 'bg-red-50 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-full',
  tomorrow: 'bg-orange-50 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded-full',
  future: 'text-text-muted text-[10px] font-bold',
  none: 'text-green-600 text-[10px] font-bold',
}

function DueLabel({ due }: { due: { label: string; urgent: string } }) {
  return <span className={DUE_STYLES[due.urgent] ?? ''}>{due.label}</span>
}

type PracticeStatus = 'wrong' | 'practiced' | 'unseen'

function PracticeStatusLabel({
  status,
  count,
}: {
  status: PracticeStatus
  count: number
}) {
  if (status === 'wrong') {
    return <span className="text-[10px] font-bold text-red-500">错题</span>
  }
  if (status === 'practiced') {
    return (
      <span className="text-[10px] font-bold text-blue-600">
        已练{count > 1 ? `×${count}` : ''}
      </span>
    )
  }
  return <span className="text-[10px] font-bold text-text-muted">未练</span>
}

export default function ProblemMasteryPanel({
  problems,
  masteryMap,
  problemSets,
}: Props) {
  const { user } = useAuth()
  const { practiceCount, lastAttemptedAt } = useMathPracticeStats(user)
  const { wrongIds } = useMathWrong(user)
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [attemptsByProblem, setAttemptsByProblem] = useState<
    Record<string, MathPracticeAttemptRow[]>
  >({})
  const today = new Date().toISOString().slice(0, 10)

  const rows = useMemo(() => {
    return problems
      .map((p) => {
        const raw = masteryMap[p.key]
        const m: WordMasteryInfo | null = raw ? ensureStageInit(raw, today) : null
        const graduated = m ? isGraduated(m) : false
        const due = graduated
          ? { label: '已毕业', urgent: 'none' as const }
          : m
            ? formatDue(m.nextReviewDate, today)
            : { label: '—', urgent: 'none' as const }
        const count = practiceCount[p.problemId] ?? 0
        const practiceStatus: PracticeStatus = wrongIds.has(p.problemId)
          ? 'wrong'
          : count > 0
            ? 'practiced'
            : 'unseen'
        const practiceTime = lastAttemptedAt[p.problemId] ?? m?.lastSeen
        return { p, m, graduated, due, count, practiceStatus, practiceTime }
      })
      .filter((r) => r.m != null || r.count > 0 || r.practiceStatus === 'wrong')
      .sort((a, b) => {
        // 按练习时间倒序：最近练习的排最前；未练习的排最后
        const ta = a.practiceTime ?? ''
        const tb = b.practiceTime ?? ''
        if (ta && tb) return tb.localeCompare(ta)
        if (ta) return -1
        if (tb) return 1
        return a.p.key.localeCompare(b.p.key)
      })
  }, [problems, masteryMap, practiceCount, lastAttemptedAt, wrongIds, today])

  const hardCount = rows.filter((r) => r.m?.isHard && !r.graduated).length
  const graduatedCount = rows.filter((r) => r.graduated).length

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, safePage])
  const rangeStart = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, rows.length)

  const pageProblemIdsKey = useMemo(
    () => pageRows.map((r) => r.p.problemId).join('\0'),
    [pageRows],
  )

  // Resolve attempts for the visible page (row → attempt id for the draft button).
  const userId = user?.id
  useEffect(() => {
    if (!open || !userId || !pageProblemIdsKey) {
      setAttemptsByProblem({})
      return
    }
    const ids = pageProblemIdsKey.split('\0').filter(Boolean)
    let cancelled = false
    void fetchPracticeAttemptsForProblems(userId, ids).then((attempts) => {
      if (cancelled) return
      const map: Record<string, MathPracticeAttemptRow[]> = {}
      for (const a of attempts) {
        ;(map[a.problemId] ??= []).push(a)
      }
      setAttemptsByProblem(map)
    })
    return () => {
      cancelled = true
    }
  }, [open, userId, pageProblemIdsKey])

  useEffect(() => {
    setPage(1)
  }, [rows.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="w-full px-0 pb-8">
      <div className="overflow-hidden rounded-[14px] border border-gray-200 bg-white">
        {/* Header / toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <span className="text-[15px]">📊</span>
            <span className="text-text-primary text-[13px] font-bold">题目学习状态</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-text-muted">
              {rows.length} 道题
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hardCount > 0 && (
              <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">
                🔥 {hardCount} 难题
              </span>
            )}
            {graduatedCount > 0 && (
              <span className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                ✓ {graduatedCount} 毕业
              </span>
            )}
            <svg
              className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </button>

        {/* Table */}
        {open && (
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-[12px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-[10px] font-bold tracking-wider text-text-muted">
                      题目
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold tracking-wider text-text-muted">
                      类型
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      阶段
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      练习时间
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      练习状态
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      草稿
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      下次复习
                    </th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted">
                      掌握
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(({ p, m, graduated, due, count, practiceStatus, practiceTime }) => {
                    const level = getMasteryLevel(m?.correct ?? 0)
                    const draftProblem = problemSets
                      ? resolveMathPlanProblem(p, problemSets)
                      : null
                    const practiceAttempt = pickPracticeAttemptForRow(
                      attemptsByProblem[p.problemId] ?? [],
                      practiceTime,
                      practiceStatus === 'wrong',
                    )
                    const displayTime = practiceAttempt?.attemptedAt ?? practiceTime
                    const canOpenDraft = Boolean(
                      problemSets &&
                        draftProblem &&
                        practiceAttempt &&
                        attemptRowHasViewableCanvas(practiceAttempt),
                    )
                    return (
                      <tr
                        key={p.key}
                        className="border-t border-gray-100"
                        style={{ opacity: graduated ? 0.6 : 1 }}
                      >
                        <td
                          className="max-w-[260px] truncate px-4 py-2 font-medium"
                          style={{ color: graduated ? '#16a34a' : undefined }}
                        >
                          {p.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[11px] text-text-muted">
                          {lessonDisplayLabel(p.lessonId, true)} ·{' '}
                          {SECTION_LABEL[p.section] ?? p.section}
                        </td>
                        <td className="px-3 py-2 text-center text-text-muted">
                          {m ? (
                            <>
                              {graduated ? '🦋' : MASTERY_ICON[level]} {m.stage ?? 0}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center text-[11px] text-text-muted">
                          {formatPracticeTime(displayTime)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <PracticeStatusLabel status={practiceStatus} count={count} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          {canOpenDraft && practiceAttempt ? (
                            <PracticeViewDraftButton
                              problem={draftProblem ?? undefined}
                              problemId={p.problemId}
                              section={p.section}
                              attemptId={practiceAttempt.id}
                              className="shrink-0"
                            />
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <DueLabel due={due} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          {graduated ? (
                            <span className="text-[10px] font-bold text-green-600">✓ 毕业</span>
                          ) : m?.isHard ? (
                            <span className="text-[10px] font-bold text-red-500">🔥 难</span>
                          ) : m ? (
                            <span className="text-text-muted">学习中</span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-[12px] text-text-muted">
                        还没有练习记录 — 完成题目后这里会显示状态
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="text-[11px] font-bold text-text-muted">
                  第 {rangeStart}–{rangeEnd} 题 · 共 {rows.length} 题
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-extrabold text-text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:border-orange-300 hover:text-orange-600"
                  >
                    ← 上一页
                  </button>
                  <span className="min-w-[4.5rem] text-center text-[11px] font-extrabold text-gray-700">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-extrabold text-text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:border-orange-300 hover:text-orange-600"
                  >
                    下一页 →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
