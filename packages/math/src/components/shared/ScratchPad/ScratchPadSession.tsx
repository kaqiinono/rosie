'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import type { ScratchObject } from './scratch-pad-types'
import type { ScratchSessionMode } from '@rosie/math/hooks/math-scratch-types'
import {
  fetchScratchWorking,
  seedWorkingFromWrongAttempt,
  upsertScratchWorking,
} from '@rosie/math/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'
import ScratchPadOverlay from './ScratchPadOverlay'

type ScratchPadSessionProps = {
  problems: Problem[]
  initialIndex?: number
  section: string
  mode?: ScratchSessionMode
  paperId?: string | null
  /** Mistake retry: seed from this wrong attempt's draft */
  seedWrongAttemptId?: string | null
  /** Mistake entry without draft — hide canvas */
  showCanvas?: boolean
  onClose: () => void
  onSolve?: (problemId: string) => void | Promise<void>
  onWrong?: (problemId: string) => void
  onResolved?: (problemId: string) => void | Promise<void>
}

export default function ScratchPadSession({
  problems,
  initialIndex = 0,
  section,
  mode = 'practice',
  paperId = null,
  seedWrongAttemptId = null,
  showCanvas: showCanvasInitial = true,
  onClose,
  onSolve,
  onWrong,
  onResolved,
}: ScratchPadSessionProps) {
  const { user } = useAuth()
  const [index, setIndex] = useState(initialIndex)
  const [objects, setObjects] = useState<ScratchObject[]>([])
  const [answerDraft, setAnswerDraft] = useState<unknown>(null)
  const [showCanvas, setShowCanvas] = useState(showCanvasInitial)
  const [attemptRefresh, setAttemptRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seededRef = useRef(false)

  const problem = problems[index]
  const readOnly = mode === 'readonly'

  const persistWorking = useCallback(
    (objs: ScratchObject[], answer: unknown) => {
      if (!user || !problem || readOnly) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void upsertScratchWorking(user.id, problem.id, paperId, objs, answer).catch(() => {})
      }, 500)
    },
    [user, problem, paperId, readOnly],
  )

  const loadProblemState = useCallback(
    async (problemId: string, opts?: { seedAttemptId?: string | null }) => {
      if (!user) {
        setObjects([])
        setAnswerDraft(null)
        setShowCanvas(mode !== 'practice' || true)
        setLoading(false)
        return
      }

      setLoading(true)

      if (opts?.seedAttemptId && !seededRef.current) {
        seededRef.current = true
        const seeded = await seedWorkingFromWrongAttempt(user.id, problemId, opts.seedAttemptId)
        setShowCanvas(seeded.hasScratch)
        const row = await fetchScratchWorking(user.id, problemId, paperId)
        setObjects(row?.objects ?? (seeded.hasScratch ? [] : []))
        setAnswerDraft(row?.answerDraft ?? seeded.answerDraft)
        setLoading(false)
        return
      }

      const row = await fetchScratchWorking(user.id, problemId, paperId)
      setObjects(row?.objects ?? [])
      setAnswerDraft(row?.answerDraft ?? null)
      setShowCanvas(true)
      setLoading(false)
    },
    [user, paperId, mode],
  )

  useEffect(() => {
    if (!problem) return
    void loadProblemState(problem.id, {
      seedAttemptId: index === initialIndex ? seedWrongAttemptId : null,
    })
  }, [problem?.id, loadProblemState, index, initialIndex, seedWrongAttemptId])

  const flushAndGo = useCallback(
    async (nextIndex: number) => {
      if (!user || !problem) return
      if (!readOnly) {
        await upsertScratchWorking(user.id, problem.id, paperId, objects, answerDraft).catch(() => {})
      }
      setIndex(nextIndex)
    },
    [user, problem, paperId, objects, answerDraft, readOnly],
  )

  const handleObjectsChange = useCallback(
    (next: ScratchObject[]) => {
      setObjects(next)
      persistWorking(next, answerDraft)
    },
    [answerDraft, persistWorking],
  )

  const handleAnswerDraftChange = useCallback(
    (snapshot: unknown) => {
      setAnswerDraft(snapshot)
      persistWorking(objects, snapshot)
    },
    [objects, persistWorking],
  )

  const handleSubmitResult = useCallback(
    async (correct: boolean, snapshot: unknown) => {
      if (!user || !problem || mode !== 'practice') return
      await submitPracticeAttempt({
        userId: user.id,
        problem,
        section,
        correct,
        objects,
        answerSnapshot: snapshot,
        paperId,
      })
      if (correct) {
        await onSolve?.(problem.id)
        await onResolved?.(problem.id)
      } else {
        onWrong?.(problem.id)
      }
      setObjects([])
      setAnswerDraft(null)
      setAttemptRefresh((n) => n + 1)
    },
    [user, problem, mode, section, objects, paperId, onSolve, onWrong, onResolved],
  )

  const handleClose = useCallback(() => {
    if (!readOnly && user && problem) {
      void upsertScratchWorking(user.id, problem.id, paperId, objects, answerDraft)
    }
    onClose()
  }, [readOnly, user, problem, paperId, objects, answerDraft, onClose])

  if (!problem || problems.length === 0) return null

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#fafafa]">
        <span className="text-sm text-slate-400">加载草稿…</span>
      </div>
    )
  }

  return (
    <ScratchPadOverlay
      problem={problem}
      initialObjects={objects}
      showCanvas={showCanvas}
      questionExpandedDefault
      mode={mode}
      section={section}
      attemptRefreshKey={attemptRefresh}
      answerDraft={answerDraft}
      onObjectsChange={handleObjectsChange}
      onAnswerDraftChange={handleAnswerDraftChange}
      onSubmitResult={mode === 'practice' ? handleSubmitResult : undefined}
      onClose={handleClose}
      edgeNav={
        problems.length > 1
          ? {
              hasPrev: index > 0,
              hasNext: index < problems.length - 1,
              positionLabel: `${index + 1} / ${problems.length}`,
              onPrev: () => void flushAndGo(index - 1),
              onNext: () => void flushAndGo(index + 1),
            }
          : undefined
      }
      mistakeHint={
        seedWrongAttemptId && index === initialIndex && showCanvas
          ? '基于错题草稿继续'
          : undefined
      }
    />
  )
}
