'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import type { ScratchObject } from './scratch-pad-types'
import type { ScratchSessionMode } from '@rosie/math-kit/hooks/math-scratch-types'
import {
  ensureInProgressAttempt,
  fetchAttemptCanvas,
  fetchPracticeAttempt,
  updateAttemptProgress,
} from '@rosie/math-kit/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math-kit/utils/submitPracticeAttempt'
import ScratchPadOverlay from './ScratchPadOverlay'

type ScratchItem = {
  problem: Problem
  section: string
}

type ScratchPadSessionProps = {
  problems?: Problem[]
  items?: ScratchItem[]
  initialIndex?: number
  controlledIndex?: number
  section?: string
  mode?: ScratchSessionMode
  paperId?: string | null
  /** Controlled in-progress attempt id (practice/quiz write). */
  attemptId?: string | null
  onAttemptId?: (id: string) => void
  /** Readonly historical attempt (replaces legacy view-draft paths). */
  viewAttemptId?: string | null
  showCanvas?: boolean
  blankCanvasOnLoad?: boolean
  disableEdgeNav?: boolean
  embedded?: boolean
  /** When true, toolbar shows「结束」instead of「完成」(caller owns onClose meaning). */
  closeEndsSession?: boolean
  onClose: () => void
  onSolve?: (problemId: string) => void | Promise<void>
  onWrong?: (problemId: string) => void
  onResolved?: (problemId: string) => void | Promise<void>
  onAnswerCorrect?: () => void
}

function resolveItems(
  problems: Problem[] | undefined,
  items: ScratchItem[] | undefined,
  section: string,
): ScratchItem[] {
  if (items && items.length > 0) return items
  return (problems ?? []).map((problem) => ({ problem, section }))
}

export default function ScratchPadSession({
  problems,
  items: itemsProp,
  initialIndex = 0,
  controlledIndex,
  section = 'lesson',
  mode = 'practice',
  paperId = null,
  attemptId: attemptIdProp = null,
  onAttemptId,
  viewAttemptId = null,
  showCanvas: showCanvasInitial = true,
  blankCanvasOnLoad = false,
  disableEdgeNav = false,
  embedded = false,
  closeEndsSession = false,
  onClose,
  onSolve,
  onWrong,
  onResolved,
  onAnswerCorrect,
}: ScratchPadSessionProps) {
  const { user } = useAuth()
  const items = resolveItems(problems, itemsProp, section)
  const queueControlled = controlledIndex !== undefined
  const [internalIndex, setInternalIndex] = useState(initialIndex)
  const index = queueControlled ? controlledIndex : internalIndex

  const [objects, setObjects] = useState<ScratchObject[]>([])
  const [answerDraft, setAnswerDraft] = useState<unknown>(null)
  const [showCanvas, setShowCanvas] = useState(showCanvasInitial)
  const [attemptRefresh, setAttemptRefresh] = useState(0)
  const [loading, setLoading] = useState(!blankCanvasOnLoad)
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(attemptIdProp)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const objectsRef = useRef<ScratchObject[]>([])
  const activeAttemptIdRef = useRef<string | null>(attemptIdProp)
  const prevProblemIdRef = useRef<string | undefined>(undefined)
  const answerDraftRef = useRef<unknown>(null)

  const item = items[index]
  const problem = item?.problem
  const itemSection = item?.section ?? section
  const readOnly = mode === 'readonly'

  const resetBlank = useCallback(() => {
    objectsRef.current = []
    setObjects([])
    setAnswerDraft(null)
    answerDraftRef.current = null
    setShowCanvas(showCanvasInitial)
    setLoading(false)
  }, [showCanvasInitial])

  const userId = user?.id
  const problemId = problem?.id

  useEffect(() => {
    activeAttemptIdRef.current = activeAttemptId
  }, [activeAttemptId])

  useEffect(() => {
    if (attemptIdProp !== undefined && attemptIdProp !== null) {
      setActiveAttemptId(attemptIdProp)
      activeAttemptIdRef.current = attemptIdProp
    }
  }, [attemptIdProp])

  useEffect(() => {
    if (!problemId) return
    if (blankCanvasOnLoad) {
      resetBlank()
      return
    }
    if (prevProblemIdRef.current !== undefined && prevProblemIdRef.current !== problemId) {
      activeAttemptIdRef.current = null
      if (attemptIdProp == null) setActiveAttemptId(null)
    }
    prevProblemIdRef.current = problemId
    setLoading(true)
    void (async () => {
      if (!userId) {
        resetBlank()
        return
      }

      if (viewAttemptId && readOnly) {
        const [loaded, attempt] = await Promise.all([
          fetchAttemptCanvas(viewAttemptId),
          fetchPracticeAttempt(viewAttemptId),
        ])
        objectsRef.current = loaded
        setObjects(loaded)
        setAnswerDraft(attempt?.answerSnapshot ?? null)
        answerDraftRef.current = attempt?.answerSnapshot ?? null
        setShowCanvas(loaded.length > 0)
        setLoading(false)
        return
      }

      const controlledId = attemptIdProp ?? activeAttemptIdRef.current
      if (controlledId) {
        const attempt = await fetchPracticeAttempt(controlledId)
        if (attempt && attempt.problemId === problemId && (attempt.status === 'in_progress' || readOnly)) {
          const loaded = attempt.objects.length > 0 ? attempt.objects : await fetchAttemptCanvas(controlledId)
          objectsRef.current = loaded
          setObjects(loaded)
          setAnswerDraft(attempt.answerSnapshot)
          answerDraftRef.current = attempt.answerSnapshot
          setShowCanvas(true)
          setLoading(false)
          return
        }
        if (attempt && attempt.problemId !== problemId) {
          activeAttemptIdRef.current = null
          setActiveAttemptId(null)
        }
      }

      if (readOnly) {
        resetBlank()
        return
      }

      const attempt = await ensureInProgressAttempt(userId, problemId, itemSection, paperId)
      activeAttemptIdRef.current = attempt.id
      setActiveAttemptId(attempt.id)
      onAttemptId?.(attempt.id)
      const loaded = attempt.objects.length > 0 ? attempt.objects : []
      objectsRef.current = loaded
      setObjects(loaded)
      setAnswerDraft(attempt.answerSnapshot)
      answerDraftRef.current = attempt.answerSnapshot
      setShowCanvas(true)
      setLoading(false)
    })()
  }, [
    problemId,
    userId,
    paperId,
    blankCanvasOnLoad,
    viewAttemptId,
    readOnly,
    itemSection,
    attemptIdProp,
    resetBlank,
    onAttemptId,
  ])

  const ensureAttemptId = useCallback(async (): Promise<string | null> => {
    if (!userId || !problemId || readOnly) return null
    if (activeAttemptIdRef.current) return activeAttemptIdRef.current
    const attempt = await ensureInProgressAttempt(userId, problemId, itemSection, paperId)
    activeAttemptIdRef.current = attempt.id
    setActiveAttemptId(attempt.id)
    onAttemptId?.(attempt.id)
    return attempt.id
  }, [userId, problemId, readOnly, itemSection, paperId, onAttemptId])

  const persistProgress = useCallback(
    (objs: ScratchObject[], answer: unknown) => {
      if (!userId || !problemId || readOnly) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const id = await ensureAttemptId()
            if (!id) return
            await updateAttemptProgress(id, objs, answer)
          } catch {
            // Canvas autosave must not block drawing.
          }
        })()
      }, 500)
    },
    [userId, problemId, readOnly, ensureAttemptId],
  )

  const flushCurrent = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
    if (!readOnly && activeAttemptIdRef.current) {
      void updateAttemptProgress(
        activeAttemptIdRef.current,
        objectsRef.current,
        answerDraftRef.current,
      ).catch(() => {})
    }
  }, [readOnly])

  const flushAndGo = useCallback(
    (nextIndex: number) => {
      flushCurrent()
      if (!queueControlled) setInternalIndex(nextIndex)
    },
    [flushCurrent, queueControlled],
  )

  const handleObjectsChange = useCallback(
    (next: ScratchObject[]) => {
      objectsRef.current = next
      setObjects(next)
      persistProgress(next, answerDraftRef.current)
    },
    [persistProgress],
  )

  const handleAnswerDraftChange = useCallback(
    (snapshot: unknown) => {
      setAnswerDraft(snapshot)
      answerDraftRef.current = snapshot
      persistProgress(objectsRef.current, snapshot)
    },
    [persistProgress],
  )

  const handleSubmitResult = useCallback(
    async (correct: boolean, snapshot: unknown, canvasObjects?: ScratchObject[]) => {
      if (!user || !problem || mode !== 'practice') return
      const snapshotObjects = canvasObjects ?? objectsRef.current
      const attemptId = activeAttemptIdRef.current ?? (await ensureAttemptId())
      try {
        await submitPracticeAttempt({
          userId: user.id,
          problem,
          section: itemSection,
          correct,
          objects: snapshotObjects,
          answerSnapshot: snapshot,
          paperId,
          attemptId,
        })
      } catch {
        // Draft/attempt persistence must not block advancing the practice queue.
      }
      activeAttemptIdRef.current = null
      setActiveAttemptId(null)
      setAttemptRefresh((n) => n + 1)
      if (correct) {
        await onSolve?.(problem.id)
        await onResolved?.(problem.id)
        objectsRef.current = []
        setObjects([])
        setAnswerDraft(null)
        answerDraftRef.current = null
        if (onAnswerCorrect) {
          await onAnswerCorrect()
        } else if (!queueControlled && index < items.length - 1) {
          flushAndGo(index + 1)
        }
      } else {
        onWrong?.(problem.id)
      }
    },
    [
      user,
      problem,
      mode,
      itemSection,
      paperId,
      index,
      items.length,
      onSolve,
      onWrong,
      onResolved,
      onAnswerCorrect,
      queueControlled,
      flushAndGo,
      ensureAttemptId,
    ],
  )

  const handleClose = useCallback(
    (canvasObjects?: ScratchObject[]) => {
      if (!readOnly && activeAttemptIdRef.current) {
        const snapshotObjects = canvasObjects ?? objectsRef.current
        void updateAttemptProgress(
          activeAttemptIdRef.current,
          snapshotObjects,
          answerDraftRef.current,
        ).catch(() => {})
      }
      onClose()
    },
    [readOnly, onClose],
  )

  if (!problem || items.length === 0) return null

  if (loading) {
    return (
      <div
        className={
          embedded
            ? 'absolute inset-0 flex items-center justify-center bg-[#fafafa]'
            : 'fixed inset-0 z-[100] flex items-center justify-center bg-[#fafafa]'
        }
      >
        <span className="text-sm text-slate-400">加载草稿…</span>
      </div>
    )
  }

  const showEdgeNav =
    !disableEdgeNav &&
    !queueControlled &&
    items.length > 1 &&
    !onAnswerCorrect

  return (
    <ScratchPadOverlay
      problem={problem}
      initialObjects={objects}
      showCanvas={showCanvas}
      questionExpandedDefault
      mode={mode}
      section={itemSection}
      attemptRefreshKey={attemptRefresh}
      answerDraft={answerDraft}
      embedded={embedded}
      closeLabel={closeEndsSession ? '结束' : '完成'}
      onObjectsChange={handleObjectsChange}
      onAnswerDraftChange={handleAnswerDraftChange}
      onSubmitResult={mode === 'practice' ? handleSubmitResult : undefined}
      onClose={handleClose}
      edgeNav={
        showEdgeNav
          ? {
              hasPrev: index > 0,
              hasNext: index < items.length - 1,
              positionLabel: `${index + 1} / ${items.length}`,
              onPrev: () => void flushAndGo(index - 1),
              onNext: () => void flushAndGo(index + 1),
            }
          : undefined
      }
    />
  )
}
