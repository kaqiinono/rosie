'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import type { Problem } from '@rosie/core'
import ScratchPadSession from '@rosie/math/components/shared/ScratchPad/ScratchPadSession'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { problemHasViewableDraft } from '@rosie/math/utils/math-scratch-db'

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
  section?: string
  /**
   * Archived draft id from `math_practice_attempts.draft_id`.
   * When set, button visibility = this id is non-null; open uses it directly.
   */
  draftId?: string | null
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
 * Plan day cards: pass `hasDraft` from batched presence.
 * Mastery / attempt rows: pass `draftId` from the attempt record (`draft_id` column).
 */
export default function PracticeViewDraftButton({
  problem: problemProp,
  problemId: problemIdProp,
  className = '',
  refreshKey = 0,
  hasDraft: hasDraftProp,
  section: sectionProp,
  draftId = null,
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
  const fromAttempt = draftId !== null && draftId !== undefined
  const batched = !fromAttempt && hasDraftProp !== undefined
  const [hasDraftLocal, setHasDraftLocal] = useState(false)
  const [checking, setChecking] = useState(!fromAttempt && !batched)
  const [open, setOpen] = useState(false)
  const [soloRefresh, setSoloRefresh] = useState(0)

  const hasDraft = fromAttempt ? Boolean(draftId) : batched ? hasDraftProp : hasDraftLocal

  const userId = user?.id

  useEffect(() => {
    if (fromAttempt) {
      setChecking(false)
      return
    }
    if (batched) {
      setChecking(false)
      return
    }
    if (!userId || !problemId) {
      setHasDraftLocal(false)
      setChecking(false)
      return
    }
    let cancelled = false
    setChecking(true)
    void problemHasViewableDraft(userId, problemId).then((ok) => {
      if (cancelled) return
      setHasDraftLocal(ok)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [fromAttempt, batched, userId, problemId, refreshKey, soloRefresh])

  function handleClose() {
    setOpen(false)
    if (!batched && !fromAttempt) setSoloRefresh((n) => n + 1)
  }

  function handleOpen() {
    if (!user || !hasDraft) return
    if (!problem) return
    setOpen(true)
  }

  // With an attempt draft id, show the button even before Problem resolves
  // (open still needs a Problem for the pad chrome).
  if (!user || !problemId || checking || !hasDraft) return null
  if (!fromAttempt && !problem) return null
  if (fromAttempt && !problem) {
    // Still show the control; click no-ops until problem is available.
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!problem}
        title={problem ? '查看本次练习草稿' : '题目数据加载中'}
        className={`cursor-pointer rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-all hover:bg-indigo-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        📝 草稿
      </button>
      {open && problem && (
        <ScratchPadSession
          problems={[problem]}
          initialIndex={0}
          section={section}
          mode="readonly"
          viewDraftId={draftId}
          preferViewableDraft={!draftId}
          showCanvas
          disableEdgeNav
          onClose={handleClose}
        />
      )}
    </>
  )
}
