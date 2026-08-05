'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useProblemScratchContext } from './ProblemScratchContext'
import ScratchPadSession from './ScratchPadSession'
import { resolveWrongAttemptId } from '@rosie/math-kit/utils/math-scratch-db'
import type { ScratchSessionMode } from '@rosie/math-kit/hooks/math-scratch-types'

type ScratchPadTriggerProps = {
  problem: Problem
  variant?: 'default' | 'compact'
  className?: string
  /** Override problem list (e.g. mistake list) */
  problems?: Problem[]
  problemIndex?: number
  section?: string
  mode?: ScratchSessionMode
  paperId?: string | null
  attemptId?: string | null
  viewAttemptId?: string | null
  onSolve?: (problemId: string) => void | Promise<void>
  onWrong?: (problemId: string) => void
  onResolved?: (problemId: string) => void | Promise<void>
  readOnly?: boolean
}

export default function ScratchPadTrigger({
  problem,
  variant = 'default',
  className = '',
  problems: problemsProp,
  problemIndex: problemIndexProp,
  section: sectionProp,
  mode = 'practice',
  paperId = null,
  attemptId = null,
  viewAttemptId = null,
  onSolve,
  onWrong,
  onResolved,
  readOnly = false,
}: ScratchPadTriggerProps) {
  const { user } = useAuth()
  const ctx = useProblemScratchContext()
  const [open, setOpen] = useState(false)

  const problems = problemsProp ?? ctx?.sectionProblems ?? [problem]
  const problemIndex =
    problemIndexProp ??
    ctx?.problemIndex ??
    Math.max(0, problems.findIndex((p) => p.id === problem.id))
  const section = sectionProp ?? ctx?.section ?? 'lesson'

  async function handleOpen() {
    if (!user) return
    setOpen(true)
  }

  if (!user && !readOnly) return null

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        title={readOnly ? '查看草稿' : '草稿纸'}
        className={
          variant === 'compact'
            ? `flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-base transition-all hover:bg-indigo-100 active:scale-95 ${className}`
            : `flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-3 py-1.5 text-[12px] font-semibold text-indigo-700 shadow-sm transition-all hover:from-indigo-100 hover:to-violet-100 active:scale-95 ${className}`
        }
      >
        <span className="text-sm leading-none">📝</span>
        {variant !== 'compact' && <span>{readOnly ? '查看草稿' : '草稿纸'}</span>}
      </button>
      {open && (
        <ScratchPadSession
          problems={problems}
          initialIndex={problemIndex}
          section={section}
          mode={readOnly ? 'readonly' : mode}
          paperId={paperId}
          attemptId={attemptId}
          viewAttemptId={readOnly ? viewAttemptId : null}
          onClose={() => setOpen(false)}
          onSolve={onSolve}
          onWrong={onWrong}
          onResolved={onResolved}
        />
      )}
    </>
  )
}

/** View-only: open the wrong attempt's archived scratch draft. */
export function WrongDraftViewButton({
  problem,
  draftLookupIds,
  problems,
  problemIndex = 0,
  hasDraft,
  className = '',
}: {
  problem: Problem
  /** Stored problem_id(s) in math_wrong / attempts (may differ from problem.id). */
  draftLookupIds: string[]
  problems?: Problem[]
  problemIndex?: number
  hasDraft: boolean
  className?: string
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)

  async function handleOpen() {
    if (!user) return
    const attemptId = await resolveWrongAttemptId(user.id, ...draftLookupIds)
    if (!attemptId) return
    setViewId(attemptId)
    setOpen(true)
  }

  if (!user || !hasDraft) return null

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        title="查看草稿"
        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-sm transition-all hover:bg-indigo-100 active:scale-95 sm:h-8 sm:w-8 ${className}`}
      >
        📝
      </button>
      {open && viewId && (
        <ScratchPadSession
          problems={problems ?? [problem]}
          initialIndex={problemIndex}
          section="mistakes"
          mode="readonly"
          paperId={null}
          viewAttemptId={viewId}
          showCanvas
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Open mistake scratch pad for a fresh retry (no copy from wrong attempt). */
export function MistakeDraftButton({
  problem,
  problems,
  problemIndex,
  onSolve,
  onWrong,
  onResolved,
  className = '',
}: {
  problem: Problem
  draftLookupIds: string[]
  problems: Problem[]
  problemIndex: number
  onSolve?: (problemId: string) => void | Promise<void>
  onWrong?: (problemId: string) => void
  onResolved?: (problemId: string) => void | Promise<void>
  className?: string
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const pendingResolvedRef = useRef<string[]>([])

  if (!user) return null

  const handleClose = () => {
    for (const id of pendingResolvedRef.current) {
      void onResolved?.(id)
    }
    pendingResolvedRef.current = []
    setOpen(false)
  }

  const handleDeferredResolved = (problemId: string) => {
    pendingResolvedRef.current.push(problemId)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="草稿纸"
        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-sm transition-all hover:bg-indigo-100 active:scale-95 sm:h-8 sm:w-8 ${className}`}
      >
        📝
      </button>
      {open && (
        <ScratchPadSession
          problems={problems}
          initialIndex={problemIndex}
          section="mistakes"
          mode="practice"
          paperId={null}
          disableEdgeNav
          onClose={handleClose}
          onSolve={onSolve}
          onWrong={onWrong}
          onResolved={onResolved ? handleDeferredResolved : undefined}
        />
      )}
    </>
  )
}

/** Open scratch from mistake list for a fresh retry (no copy from wrong attempt). */
export function MistakeScratchButton({
  problems,
  problemIndex,
  onSolve,
  onWrong,
  onResolved,
}: {
  problem: Problem
  problems: Problem[]
  problemIndex: number
  onSolve?: (problemId: string) => void | Promise<void>
  onWrong?: (problemId: string) => void
  onResolved?: (problemId: string) => void | Promise<void>
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white no-underline"
      >
        继续练
      </button>
      {open && (
        <ScratchPadSession
          problems={problems}
          initialIndex={problemIndex}
          section="mistakes"
          mode="practice"
          paperId={null}
          onClose={() => setOpen(false)}
          onSolve={onSolve}
          onWrong={onWrong}
          onResolved={onResolved}
        />
      )}
    </>
  )
}
