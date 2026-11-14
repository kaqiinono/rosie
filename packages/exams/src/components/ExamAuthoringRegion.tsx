'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type ExamAuthoringTarget = { groupId: string } & (
  | { kind: 'blocks'; blockIds: readonly string[] }
  | { kind: 'activity'; activityId: string; field: 'title' | 'wordBank' | 'choices' }
  | { kind: 'material'; materialId: string }
  | { kind: 'options'; questionId: string }
  | { kind: 'pool'; poolId: string }
)

/** Optional presentation outlet. Student routes never supply an authoring provider. */
export const ExamAuthoringContext = createContext<((target: ExamAuthoringTarget, content: ReactNode) => ReactNode) | null>(null)

/** Opens the current exercise's questions for editing. Absent on student routes. */
export const ExamActivityEditContext = createContext<{ start: () => void; disabled: boolean } | null>(null)

export function ExamAuthoringRegion({ target, children }: { target: ExamAuthoringTarget; children: ReactNode }) {
  const render = useContext(ExamAuthoringContext)
  return render ? render(target, children) : children
}
