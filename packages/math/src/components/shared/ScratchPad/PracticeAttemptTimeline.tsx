'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@rosie/core'
import type { MathPracticeAttemptRow } from '@rosie/math/hooks/math-scratch-types'
import { fetchPracticeAttemptsForProblem } from '@rosie/math/utils/math-scratch-db'
import ScratchPadContentPreview from './ScratchPadContentPreview'

type PracticeAttemptTimelineProps = {
  problemId: string
  refreshKey?: number
  onViewDraft?: (attempt: MathPracticeAttemptRow) => void
}

function formatAttemptTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PracticeAttemptTimeline({
  problemId,
  refreshKey = 0,
  onViewDraft,
}: PracticeAttemptTimelineProps) {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<MathPracticeAttemptRow[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setAttempts([])
      return
    }
    void fetchPracticeAttemptsForProblem(user.id, problemId).then(setAttempts)
  }, [user, problemId, refreshKey])

  if (attempts.length === 0) return null

  const previewAttempt = previewId ? attempts.find((a) => a.id === previewId) : null

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">练习记录</div>
      <ul className="flex flex-col gap-1.5">
        {attempts.map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                if (a.draftId) {
                  setPreviewId(a.id === previewId ? null : a.id)
                  onViewDraft?.(a)
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-left transition hover:bg-slate-100"
            >
              <span className="text-sm">{a.correct ? '✅' : '❌'}</span>
              <span className="min-w-0 flex-1 text-[12px] font-medium text-slate-700">
                第 {attempts.length - i} 次 · {a.correct ? '做对' : '做错'} ·{' '}
                {formatAttemptTime(a.attemptedAt)}
              </span>
              {a.draftId && (
                <span
                  className={`text-[10px] font-semibold ${a.correct ? 'text-indigo-500' : 'text-rose-500'}`}
                >
                  {a.correct ? '看草稿' : '看错草稿'}
                </span>
              )}
            </button>
            {previewId === a.id && a.draftId && previewAttempt?.id === a.id && (
              <div
                className={`mt-1.5 overflow-hidden rounded-lg border bg-white p-1 ${a.correct ? 'border-slate-100' : 'border-rose-200'}`}
              >
                {!a.correct && (
                  <p className="mb-1 rounded bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">
                    这次做错了，仅供参考演算过程，勿当作正确答案。
                  </p>
                )}
                <DraftPreview draftId={a.draftId} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DraftPreview({ draftId }: { draftId: string }) {
  const [objects, setObjects] = useState<import('./scratch-pad-types').ScratchObject[] | null>(null)

  useEffect(() => {
    void import('@rosie/math/utils/math-scratch-db').then(({ fetchScratchDraft }) =>
      fetchScratchDraft(draftId).then((d) => setObjects(d?.objects ?? [])),
    )
  }, [draftId])

  if (!objects) return <p className="p-2 text-[11px] text-slate-400">加载中…</p>
  if (objects.length === 0) return <p className="p-2 text-[11px] text-slate-400">无画布内容</p>
  return <ScratchPadContentPreview objects={objects} />
}
