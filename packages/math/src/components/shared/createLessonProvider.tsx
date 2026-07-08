'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathWrong } from '@rosie/math/hooks/useMathWrong'
import { useStarHud } from '@rosie/rewards'
import { LessonScratchActionsProvider } from '@rosie/math/components/shared/ScratchPad/LessonScratchActionsContext'

interface LessonContextType {
  solveCount: Record<string, number>
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
    const { solveCount, handleSolve: solveAndSync } = useMathSolved(user)
    const { wrongIds, addWrong: addWrongRow, removeWrong: removeWrongRow, markResolved: markResolvedRow } =
      useMathWrong(user)
    const { awardStars } = useStarHud()
    const [toast, setToast] = useState<string | null>(null)
    const [showCongrats, setShowCongrats] = useState(false)

    const solved = useMemo(() => {
      const next: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(solveCount)) {
        if (v >= 1) next[k] = true
      }
      return next
    }, [solveCount])

    const handleSolve = useCallback(async (id: string) => {
      const newCount = await solveAndSync(id)

      if (wrongIds.has(id)) {
        void markResolvedRow(id)
      }

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
    }, [solveAndSync, wrongIds, markResolvedRow, awardStars])

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
        onWrong: addWrong,
        onResolved: markResolvedCb,
      }),
      [handleSolve, addWrong, markResolvedCb],
    )

    const contextValue = useMemo(
      () => ({
        solveCount,
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
        solveCount,
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
