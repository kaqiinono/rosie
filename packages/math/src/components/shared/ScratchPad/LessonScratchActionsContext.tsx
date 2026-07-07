'use client'

import { createContext, useContext } from 'react'

export type LessonScratchActions = {
  onSolve: (problemId: string) => void | Promise<void>
  onWrong: (problemId: string) => void
  onResolved: (problemId: string) => void | Promise<void>
}

const LessonScratchActionsContext = createContext<LessonScratchActions | null>(null)

export function LessonScratchActionsProvider({
  value,
  children,
}: {
  value: LessonScratchActions
  children: React.ReactNode
}) {
  return (
    <LessonScratchActionsContext.Provider value={value}>
      {children}
    </LessonScratchActionsContext.Provider>
  )
}

export function useLessonScratchActions(): LessonScratchActions | null {
  return useContext(LessonScratchActionsContext)
}
