'use client'

import { createContext, useContext } from 'react'
import type { Problem } from '@rosie/core'

export type ProblemScratchContextValue = {
  sectionProblems: Problem[]
  section: string
  problemIndex: number
  basePath: string
}

const ProblemScratchContext = createContext<ProblemScratchContextValue | null>(null)

export function ProblemScratchProvider({
  value,
  children,
}: {
  value: ProblemScratchContextValue
  children: React.ReactNode
}) {
  return <ProblemScratchContext.Provider value={value}>{children}</ProblemScratchContext.Provider>
}

export function useProblemScratchContext(): ProblemScratchContextValue | null {
  return useContext(ProblemScratchContext)
}
