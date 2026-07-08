'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import { useAuth } from '@rosie/core'
import type { ScratchObject } from './scratch-pad-types'
import type { ScratchSessionMode } from '@rosie/math/hooks/math-scratch-types'
import { upsertScratchWorking } from '@rosie/math/utils/math-scratch-db'
import { submitPracticeAttempt } from '@rosie/math/utils/submitPracticeAttempt'
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
  seedWrongAttemptId?: string | null
  showCanvas?: boolean
  blankCanvasOnLoad?: boolean
  disableEdgeNav?: boolean
  embedded?: boolean
  /** When true, toolbar 完成 ends the session via onClose */
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
  seedWrongAttemptId = null,
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
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const objectsRef = useRef<ScratchObject[]>([])

  const item = items[index]
  const problem = item?.problem
  const itemSection = item?.section ?? section
  const readOnly = mode === 'readonly'

  const resetBlank = useCallback(() => {
    objectsRef.current = []
    setObjects([])
    setAnswerDraft(null)
    setShowCanvas(showCanvasInitial)
    setLoading(false)
  }, [showCanvasInitial])

  useEffect(() => {
    if (!problem) return
    if (blankCanvasOnLoad) {
      resetBlank()
      return
    }
    setLoading(true)
    void (async () => {
      if (!user) {
        resetBlank()
        return
      }
      const { fetchScratchWorking, seedWorkingFromWrongAttempt } = await import(
        '@rosie/math/utils/math-scratch-db'
      )
      if (seedWrongAttemptId && index === initialIndex) {
        const seeded = await seedWorkingFromWrongAttempt(user.id, problem.id, seedWrongAttemptId)
        setShowCanvas(seeded.hasScratch)
        const row = await fetchScratchWorking(user.id, problem.id, paperId)
        const loaded = row?.objects ?? []
        objectsRef.current = loaded
        setObjects(loaded)
        setAnswerDraft(row?.answerDraft ?? seeded.answerDraft)
        setLoading(false)
        return
      }
      const row = await fetchScratchWorking(user.id, problem.id, paperId)
      const loaded = row?.objects ?? []
      objectsRef.current = loaded
      setObjects(loaded)
      setAnswerDraft(row?.answerDraft ?? null)
      setShowCanvas(true)
      setLoading(false)
    })()
  }, [
    problem?.id,
    user,
    paperId,
    blankCanvasOnLoad,
    seedWrongAttemptId,
    index,
    initialIndex,
    resetBlank,
    problem,
  ])

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

  const flushCurrent = useCallback(() => {
    if (!readOnly && user && problem) {
      void upsertScratchWorking(user.id, problem.id, paperId, objectsRef.current, answerDraft).catch(
        () => {},
      )
    }
  }, [readOnly, user, problem, paperId, answerDraft])

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
      persistWorking(next, answerDraft)
    },
    [answerDraft, persistWorking],
  )

  const handleAnswerDraftChange = useCallback(
    (snapshot: unknown) => {
      setAnswerDraft(snapshot)
      persistWorking(objectsRef.current, snapshot)
    },
    [persistWorking],
  )

  const handleSubmitResult = useCallback(
    async (correct: boolean, snapshot: unknown, canvasObjects?: ScratchObject[]) => {
      if (!user || !problem || mode !== 'practice') return
      const snapshotObjects = canvasObjects ?? objectsRef.current
      try {
        await submitPracticeAttempt({
          userId: user.id,
          problem,
          section: itemSection,
          correct,
          objects: snapshotObjects,
          answerSnapshot: snapshot,
          paperId,
        })
      } catch {
        // Draft/attempt persistence must not block advancing the practice queue.
      }
      setAttemptRefresh((n) => n + 1)
      if (correct) {
        await onSolve?.(problem.id)
        await onResolved?.(problem.id)
        objectsRef.current = []
        setObjects([])
        setAnswerDraft(null)
        if (onAnswerCorrect) {
          await onAnswerCorrect()
        } else if (!queueControlled && index < items.length - 1) {
          flushAndGo(index + 1)
        }
      } else {
        onWrong?.(problem.id)
        await upsertScratchWorking(user.id, problem.id, paperId, snapshotObjects, snapshot)
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
    ],
  )

  const handleClose = useCallback(
    (canvasObjects?: ScratchObject[]) => {
      if (!readOnly && user && problem) {
        const snapshotObjects = canvasObjects ?? objectsRef.current
        void upsertScratchWorking(user.id, problem.id, paperId, snapshotObjects, answerDraft)
      }
      onClose()
    },
    [readOnly, user, problem, paperId, answerDraft, onClose],
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
      mistakeHint={
        seedWrongAttemptId && index === initialIndex && showCanvas
          ? '基于错题草稿继续'
          : undefined
      }
    />
  )
}
