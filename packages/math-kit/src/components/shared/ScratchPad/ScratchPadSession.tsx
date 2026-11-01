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

export default function ScratchPadSession(props: ScratchPadSessionProps) {
  const { user } = useAuth()
  const items = resolveItems(props.problems, props.items, props.section ?? 'lesson')
  const [internalIndex, setIndex] = useState(props.initialIndex ?? 0)
  const index = props.controlledIndex ?? internalIndex
  const item = items[index]
  const key = JSON.stringify([user?.id, item?.problem.id, item?.section, props.paperId,
    props.viewAttemptId, props.mode, props.blankCanvasOnLoad])
  return <ScratchPadItem key={key} {...props} items={items} index={index} setIndex={setIndex} />
}

function ScratchPadItem({
  items,
  index,
  setIndex,
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
}: ScratchPadSessionProps & { items: ScratchItem[]; index: number; setIndex: (index: number) => void }) {
  const { user } = useAuth()
  const queueControlled = controlledIndex !== undefined
  const [objects, setObjects] = useState<ScratchObject[]>([])
  const [answerDraft, setAnswerDraft] = useState<unknown>(null)
  const [showCanvas, setShowCanvas] = useState(showCanvasInitial)
  const [attemptRefresh, setAttemptRefresh] = useState(0)
  const [loadedAttempt, setLoadedAttempt] = useState<string | null>()
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const objectsRef = useRef<ScratchObject[]>([])
  const activeAttemptIdRef = useRef<string | null>(attemptIdProp)
  const answerDraftRef = useRef<unknown>(null)

  const item = items[index]
  const problem = item?.problem
  const itemSection = item?.section ?? section
  const readOnly = mode === 'readonly'

  const userId = user?.id
  const problemId = problem?.id
  const needsLoad = !!problemId && !!userId && !blankCanvasOnLoad && (!readOnly || !!viewAttemptId || !!attemptIdProp)
  const loading = needsLoad && loadedAttempt !== attemptIdProp

  useEffect(() => {
    if (attemptIdProp) activeAttemptIdRef.current = attemptIdProp
  }, [attemptIdProp])

  useEffect(() => {
    if (!needsLoad || !userId || !problemId) return
    let cancelled = false
    void (async () => {
      if (viewAttemptId && readOnly) {
        const [loaded, attempt] = await Promise.all([
          fetchAttemptCanvas(viewAttemptId),
          fetchPracticeAttempt(viewAttemptId),
        ])
        if (cancelled) return
        objectsRef.current = loaded
        setObjects(loaded)
        setAnswerDraft(attempt?.answerSnapshot ?? null)
        answerDraftRef.current = attempt?.answerSnapshot ?? null
        setShowCanvas(loaded.length > 0)
        setLoadedAttempt(attemptIdProp)
        return
      }

      const controlledId = attemptIdProp ?? activeAttemptIdRef.current
      if (controlledId) {
        const attempt = await fetchPracticeAttempt(controlledId)
        if (cancelled) return
        if (attempt && attempt.problemId === problemId && (attempt.status === 'in_progress' || readOnly)) {
          const loaded = attempt.objects.length > 0 ? attempt.objects : await fetchAttemptCanvas(controlledId)
          if (cancelled) return
          objectsRef.current = loaded
          setObjects(loaded)
          setAnswerDraft(attempt.answerSnapshot)
          answerDraftRef.current = attempt.answerSnapshot
          setShowCanvas(true)
          setLoadedAttempt(attemptIdProp)
          return
        }
        if (attempt && attempt.problemId !== problemId) {
          activeAttemptIdRef.current = null
        }
      }

      if (readOnly) {
        objectsRef.current = []
        answerDraftRef.current = null
        setObjects([])
        setAnswerDraft(null)
        setShowCanvas(showCanvasInitial)
        setLoadedAttempt(attemptIdProp)
        return
      }

      const attempt = await ensureInProgressAttempt(userId, problemId, itemSection, paperId)
      if (cancelled) return
      activeAttemptIdRef.current = attempt.id
      onAttemptId?.(attempt.id)
      const loaded = attempt.objects.length > 0 ? attempt.objects : []
      objectsRef.current = loaded
      setObjects(loaded)
      setAnswerDraft(attempt.answerSnapshot)
      answerDraftRef.current = attempt.answerSnapshot
      setShowCanvas(true)
      setLoadedAttempt(attemptIdProp)
    })()
    return () => { cancelled = true }
  }, [
    problemId,
    userId,
    paperId,
    needsLoad,
    viewAttemptId,
    readOnly,
    itemSection,
    attemptIdProp,
    showCanvasInitial,
    onAttemptId,
  ])

  const ensureAttemptId = useCallback(async (): Promise<string | null> => {
    if (!userId || !problemId || readOnly) return null
    if (activeAttemptIdRef.current) return activeAttemptIdRef.current
    const attempt = await ensureInProgressAttempt(userId, problemId, itemSection, paperId)
    activeAttemptIdRef.current = attempt.id
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
      if (!queueControlled) setIndex(nextIndex)
    },
    [flushCurrent, queueControlled, setIndex],
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
      await submitPracticeAttempt({
        userId: user.id,
        problem,
        section: itemSection,
        result: correct ? 'correct' : 'wrong',
        objects: snapshotObjects,
        answerSnapshot: snapshot,
        paperId,
        attemptId,
      })
      activeAttemptIdRef.current = null
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
