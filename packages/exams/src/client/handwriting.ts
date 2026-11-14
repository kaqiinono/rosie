'use client'

import { createUserSessionStore } from '@rosie/core'
import type { ExamHandwritingReview } from '../types/assessment'
import { examRequest } from './examApi'

export interface HandwritingAssessment {
  version: string | null
  reviews: ExamHandwritingReview[]
  references: { questionId: string; acceptedAnswerSets: readonly (readonly { gapId: string; value: string }[])[] }[]
}
const stores = new Map<string, ReturnType<typeof createUserSessionStore<HandwritingAssessment>>>()
export function handwritingAssessmentStore(attemptId: string, ownerId?: string) {
  const key = `exam-handwriting:${ownerId ?? 'self'}:${attemptId}`
  let store = stores.get(key)
  if (!store) {
    store = createUserSessionStore<HandwritingAssessment>(key, { empty: { version: null, reviews: [], references: [] },
      fetch: userId => examRequest(userId, `/api/exams/attempts/${attemptId}/handwriting-grades${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`) })
    stores.set(key, store)
  }
  return store
}
