'use client'

import { useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import { useProblemScratchContext } from './ProblemScratchContext'
import ScratchPadSession from './ScratchPadSession'
import { fetchWrongAttemptId } from '@rosie/math/utils/math-scratch-db'
import type { ScratchSessionMode } from '@rosie/math/hooks/math-scratch-types'

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
  seedWrongAttemptId?: string | null
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
  seedWrongAttemptId = null,
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
          seedWrongAttemptId={seedWrongAttemptId}
          onClose={() => setOpen(false)}
          onSolve={onSolve}
          onWrong={onWrong}
          onResolved={onResolved}
        />
      )}
    </>
  )
}

/** Open scratch from mistake list — resolves wrong attempt draft id first. */
export function MistakeScratchButton({
  problem,
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
  const [seedId, setSeedId] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(true)

  async function handleOpen() {
    if (!user) return
    const attemptId = await fetchWrongAttemptId(user.id, problem.id)
    setSeedId(attemptId)
    if (attemptId) {
      const { fetchPracticeAttempt } = await import('@rosie/math/utils/math-scratch-db')
      const attempt = await fetchPracticeAttempt(attemptId)
      setHasDraft(Boolean(attempt?.draftId))
    } else {
      setHasDraft(false)
    }
    setOpen(true)
  }

  if (!user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
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
          seedWrongAttemptId={hasDraft ? seedId : null}
          showCanvas={hasDraft}
          onClose={() => setOpen(false)}
          onSolve={onSolve}
          onWrong={onWrong}
          onResolved={onResolved}
        />
      )}
    </>
  )
}
