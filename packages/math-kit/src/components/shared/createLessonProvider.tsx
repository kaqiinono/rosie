'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import { useStarHud } from '@rosie/rewards'
import { LessonScratchActionsProvider } from '@rosie/math-kit/components/shared/ScratchPad/LessonScratchActionsContext'

interface LessonContextType {
  practiceCount: Record<string, number>
  correctCount: Record<string, number>
  wrongCount: Record<string, number>
  lastAttemptedAt: Record<string, string>
  lastCorrectAt: Record<string, string>
  solved: Record<string, boolean>
  handleSolve: (id: string) => void
  wrongIds: Set<string>
  addWrong: (id: string) => void
  removeWrong: (id: string) => void
  markResolved: (id: string) => void
  toast: string | null
  setToast: (msg: string | null) => void
  showCongrats: boolean
  setShowCongrats: (v: boolean) => void
}

export type { LessonContextType }

/**
 * Factory that creates a lesson context + provider + hook triple.
 * Eliminates 100% identical LessonXXProvider code across lessons.
 */
export function createLessonProvider(displayName: string): {
  Provider: (props: { children: ReactNode }) => ReactNode
  useLessonContext: () => LessonContextType
} {
  const Ctx = createContext<LessonContextType | null>(null)

  function useLessonContext(): LessonContextType {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error(`use${displayName} must be used within ${displayName}Provider`)
    return ctx
  }

  function Provider({ children }: { children: ReactNode }): ReactNode {
    const { user } = useAuth()
    const {
      practiceCount,
      correctCount,
      wrongCount,
      lastAttemptedAt,
      lastCorrectAt,
    } = useMathPracticeStats(user)
    const { wrongIds, addWrong: addWrongRow, removeWrong: removeWrongRow, markResolved: markResolvedRow } =
      useMathWrong(user)
    const { awardStars } = useStarHud()
    const [toast, setToast] = useState<string | null>(null)
    const [showCongrats, setShowCongrats] = useState(false)

    const solved = useMemo(() => {
      const next: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(correctCount)) {
        if (v >= 1) next[k] = true
      }
      return next
    }, [correctCount])

    const handleSolve = useCallback(async (id: string) => {
      const newCount = (correctCount[id] ?? 0) + 1

      void awardStars('blue', 1)

      if (newCount === 1) {
        setShowCongrats(true)
      } else if (newCount === 2) {
        setToast('💪 第2次答对！再练一次就掌握了！')
      } else if (newCount === 3) {
        setToast('🏆 已掌握！答对3次，厉害！')
      } else {
        setToast(`⭐ 第${newCount}次答对！继续保持！`)
      }
    }, [correctCount, awardStars])

    const addWrong = useCallback(
      (id: string) => {
        addWrongRow(id)
      },
      [addWrongRow],
    )

    const removeWrong = useCallback(
      (id: string) => {
        void removeWrongRow(id)
      },
      [removeWrongRow],
    )

    const markResolvedCb = useCallback(
      (id: string) => {
        void markResolvedRow(id)
      },
      [markResolvedRow],
    )

    const scratchActions = useMemo(
      () => ({
        onSolve: handleSolve,
        // submitPracticeAttempt owns both math_wrong projections atomically.
        onWrong: () => undefined,
        onResolved: () => undefined,
      }),
      [handleSolve],
    )

    const contextValue = useMemo(
      () => ({
        practiceCount,
        correctCount,
        wrongCount,
        lastAttemptedAt,
        lastCorrectAt,
        solved,
        handleSolve,
        wrongIds,
        addWrong,
        removeWrong,
        markResolved: markResolvedCb,
        toast,
        setToast,
        showCongrats,
        setShowCongrats,
      }),
      [
        practiceCount,
        correctCount,
        wrongCount,
        lastAttemptedAt,
        lastCorrectAt,
        solved,
        handleSolve,
        wrongIds,
        addWrong,
        removeWrong,
        markResolvedCb,
        toast,
        showCongrats,
      ],
    )

    return (
      <Ctx.Provider value={contextValue}>
        <LessonScratchActionsProvider value={scratchActions}>
          {children}
        </LessonScratchActionsProvider>
      </Ctx.Provider>
    )
  }

  Provider.displayName = `${displayName}Provider`

  return { Provider, useLessonContext }
}
