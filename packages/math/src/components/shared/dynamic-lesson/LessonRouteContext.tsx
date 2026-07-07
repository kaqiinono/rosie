'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { notFound } from 'next/navigation'
import {
  resolveLessonRoute,
  type ResolvedLessonRoute,
} from '@rosie/math/utils/lesson-route-utils'

const LessonRouteContext = createContext<ResolvedLessonRoute | null>(null)

export function LessonRouteProvider({
  grade,
  seq,
  children,
}: {
  grade: number
  seq: number
  children: ReactNode
}) {
  const value = useMemo(() => {
    if (!Number.isFinite(grade) || !Number.isFinite(seq)) return null
    return resolveLessonRoute(grade, seq) ?? null
  }, [grade, seq])

  if (!value) notFound()

  return <LessonRouteContext.Provider value={value}>{children}</LessonRouteContext.Provider>
}

export function useLessonRoute(): ResolvedLessonRoute {
  const ctx = useContext(LessonRouteContext)
  if (!ctx) {
    throw new Error('useLessonRoute must be used within a valid lesson route (LessonRouteProvider)')
  }
  return ctx
}
