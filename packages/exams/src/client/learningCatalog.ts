'use client'

import { createUserSessionStore } from '@rosie/core'
import type { ExamCatalogEntry, ExamPracticePage } from '../types/catalog'
import type { ExamAttemptListItem } from '../types/attempts'
import { examRequest } from './examApi'

export const attemptListStore = createUserSessionStore<{ items: ExamAttemptListItem[] }>('exam-attempts', {
  empty: { items: [] }, fetch: userId => examRequest(userId, '/api/exams/attempts'),
})

export const examCatalogStore = createUserSessionStore<{ items: ExamCatalogEntry[]; hasMore: boolean }>('exams-catalog', {
  empty: { items: [], hasMore: false }, fetch: userId => examRequest(userId, '/api/exams/catalog?pageSize=100'),
})

const stores = new Map<string, ReturnType<typeof createUserSessionStore<ExamPracticePage>>>()
export function practiceCatalogStore(query: string) {
  let store = stores.get(query)
  if (!store) {
    store = createUserSessionStore<ExamPracticePage>(`exam-practice:${query}`, {
      empty: { items: [], page: 1, pageSize: 25, hasMore: false, catalogLimited: false, optionsLimited: false,
        options: { revisions: [], sections: [], parts: [], domains: [], questionTypes: [], knowledgePoints: [], words: [] } },
      fetch: userId => examRequest(userId, `/api/exams/practice?${query}`),
    })
    stores.set(query, store)
  }
  return store
}
