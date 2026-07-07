'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { Problem, ProblemSet } from '@rosie/core'
import { useAuth } from '@rosie/core'
import type { MathPracticeAttemptRow } from '@rosie/math/hooks/math-scratch-types'
import ScratchPadContentPreview from '@rosie/math/components/shared/ScratchPad/ScratchPadContentPreview'
import { fetchLessonDraftAttempts, fetchScratchDraft } from '@rosie/math/utils/math-scratch-db'
import {
  findProblemInSet,
  problemDetailHref,
  sectionSourceLabel,
} from '@rosie/math/utils/problem-location'

type Props = {
  basePath: string
  lessonId: string
  problems: ProblemSet
}

type DraftEntry = {
  attempt: MathPracticeAttemptRow
  problem: Problem | null
  href: string | null
  sourceLabel: string | null
}

function formatAttemptTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function buildDraftEntries(
  attempts: MathPracticeAttemptRow[],
  lessonId: string,
  basePath: string,
  problems: ProblemSet,
): DraftEntry[] {
  return attempts.map((attempt) => {
    const loc = findProblemInSet(problems, attempt.problemId)
    if (!loc) {
      return {
        attempt,
        problem: null,
        href: null,
        sourceLabel: null,
      }
    }
    return {
      attempt,
      problem: loc.problem,
      href: problemDetailHref(basePath, loc.section, loc.index),
      sourceLabel: sectionSourceLabel(lessonId, loc.section),
    }
  })
}

function DraftPreview({ draftId }: { draftId: string }) {
  const [objects, setObjects] = useState<import('@rosie/math/components/shared/ScratchPad/scratch-pad-types').ScratchObject[] | null>(null)

  useEffect(() => {
    void fetchScratchDraft(draftId).then((d) => setObjects(d?.objects ?? []))
  }, [draftId])

  if (!objects) return <p className="p-2 text-[11px] text-slate-400">加载中…</p>
  if (objects.length === 0) return <p className="p-2 text-[11px] text-slate-400">无画布内容</p>
  return <ScratchPadContentPreview objects={objects} />
}

export default function LessonDraftsPage({ basePath, lessonId, problems }: Props) {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<MathPracticeAttemptRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setAttempts([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    void fetchLessonDraftAttempts(user.id, lessonId).then((rows) => {
      setAttempts(rows)
      setIsLoading(false)
    })
  }, [user, lessonId])

  const entries = useMemo(
    () => buildDraftEntries(attempts, lessonId, basePath, problems),
    [attempts, lessonId, basePath, problems],
  )

  return (
    <div>
      <div className="mb-4 rounded-[14px] border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4">
        <div className="flex items-center gap-2 text-sm font-extrabold text-indigo-900">
          🗒️ 练习草稿
          {!isLoading && entries.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
              {entries.length} 条
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-indigo-700/80">按练习时间从新到旧排列 · 做错草稿仅供参考演算过程</p>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-[13px] text-text-muted">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="text-5xl">📄</div>
          <div className="text-[15px] font-bold text-text-primary">还没有练习草稿</div>
          <div className="text-[13px] text-text-muted">在题目详情页拍照或打开草稿纸练习后，提交答案会出现在这里</div>
          <Link
            href={basePath}
            className="mt-2 rounded-full bg-indigo-600 px-5 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_3px_10px_rgba(79,70,229,0.25)]"
          >
            去做题 →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(({ attempt, problem, href, sourceLabel }, index) => {
            const expanded = previewId === attempt.id
            const title = problem?.title ?? attempt.problemId

            return (
              <div
                key={attempt.id}
                className={clsx(
                  'rounded-[12px] border bg-white p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
                  attempt.correct ? 'border-slate-200' : 'border-rose-200',
                )}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-base leading-none">{attempt.correct ? '✅' : '❌'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-text-primary">{title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
                      <span>第 {entries.length - index} 次</span>
                      <span>·</span>
                      <span>{attempt.correct ? '做对' : '做错'}</span>
                      <span>·</span>
                      <span>{formatAttemptTime(attempt.attemptedAt)}</span>
                      {sourceLabel && (
                        <>
                          <span>·</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-px font-semibold text-slate-600">
                            {sourceLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {attempt.draftId && (
                      <button
                        type="button"
                        onClick={() => setPreviewId(expanded ? null : attempt.id)}
                        className={clsx(
                          'rounded-full px-3 py-1.5 text-[11px] font-semibold',
                          attempt.correct
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-rose-50 text-rose-700',
                        )}
                      >
                        {expanded ? '收起' : attempt.correct ? '看草稿' : '看错草稿'}
                      </button>
                    )}
                    {href && (
                      <Link
                        href={href}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 no-underline"
                      >
                        题目
                      </Link>
                    )}
                  </div>
                </div>

                {!attempt.correct && (
                  <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700">
                    这次做错了，仅供参考演算过程，勿当作正确答案。
                  </p>
                )}

                {expanded && attempt.draftId && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50 p-1">
                    <DraftPreview draftId={attempt.draftId} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
