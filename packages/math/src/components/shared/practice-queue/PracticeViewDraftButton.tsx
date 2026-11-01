'use client'

import { useMemo, useState } from 'react'
import { useDraftQuery } from '@rosie/math-kit/hooks/useDraftQuery'
import { useAuth } from '@rosie/core'
import type { Problem } from '@rosie/core'
import ScratchPadSession from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadSession'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { problemHasViewableDraft, resolveViewableAttemptId } from '@rosie/math-kit/utils/math-scratch-db'

type Props = {
  /** Full problem (practice portal / plan card with resolved Problem). */
  problem?: Problem
  /** When Problem is unavailable (fallback id only). */
  problemId?: string
  className?: string
  /** Bump after submit so draft button visibility refreshes (solo-check mode). */
  refreshKey?: number
  /**
   * When provided, skip the per-button network check (plan page batch load).
   * Pass a boolean always on plan pages — never leave undefined there.
   */
  hasDraft?: boolean
  /** When set, skip presence check and open this attempt readonly. */
  attemptId?: string | null
  section?: string
}

function resolveProblem(problem: Problem | undefined, problemId: string | undefined): Problem | null {
  if (problem) return problem
  if (!problemId) return null
  return SEA_POOL.find((sp) => sp.problem.id === problemId)?.problem ?? null
}

function resolveSection(problemId: string | undefined, sectionProp?: string): string {
  if (sectionProp) return sectionProp
  if (!problemId) return 'lesson'
  return SEA_POOL.find((sp) => sp.problem.id === problemId)?.section ?? 'lesson'
}

/**
 * Open the same readonly ScratchPad canvas as the lesson detail「查看草稿」.
 * Close is always local「完成」— never practice-queue exit / stash.
 *
 * On plan pages, pass `hasDraft` from a batched `useViewableDraftIds` load.
 */
export default function PracticeViewDraftButton({
  problem: problemProp,
  problemId: problemIdProp,
  className = '',
  refreshKey = 0,
  hasDraft: hasDraftProp,
  attemptId: attemptIdProp = null,
  section: sectionProp,
}: Props) {
  const problemId = problemIdProp ?? problemProp?.id
  const problem = useMemo(
    () => resolveProblem(problemProp, problemId),
    [problemProp, problemId],
  )
  const section = useMemo(
    () => resolveSection(problemId, sectionProp),
    [problemId, sectionProp],
  )
  const { user } = useAuth()
  const fromAttempt = Boolean(attemptIdProp)
  const batched = hasDraftProp !== undefined
  const [open, setOpen] = useState(false)
  const [soloRefresh, setSoloRefresh] = useState(0)
  const [viewAttemptId, setViewAttemptId] = useState<string | null>(null)

  const userId = user?.id
  const loadDraft = useMemo(() =>
    !batched && !fromAttempt && userId && problemId
      ? () => problemHasViewableDraft(userId, problemId)
      : null,
    [batched, fromAttempt, userId, problemId],
  )
  const draftFound = useDraftQuery(loadDraft, JSON.stringify([refreshKey, soloRefresh]))
  const hasDraft = fromAttempt || (hasDraftProp ?? draftFound)

  function handleClose() {
    setOpen(false)
    if (!batched && !fromAttempt) setSoloRefresh((n) => n + 1)
  }

  function handleOpen() {
    if (!user || !hasDraft || !problem || !userId || !problemId) return
    if (fromAttempt && attemptIdProp) {
      setViewAttemptId(attemptIdProp)
      setOpen(true)
      return
    }
    void resolveViewableAttemptId(userId, problemId).then((id) => {
      if (!id) return
      setViewAttemptId(id)
      setOpen(true)
    })
  }

  if (!user || !problemId || !problem || !hasDraft) return null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="查看草稿"
        className={`cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95 ${className}`}
      >
        📝 草稿
      </button>
      {open && viewAttemptId && (
        <ScratchPadSession
          problems={[problem]}
          initialIndex={0}
          section={section}
          mode="readonly"
          viewAttemptId={viewAttemptId}
          showCanvas
          disableEdgeNav
          onClose={handleClose}
        />
      )}
    </>
  )
}
