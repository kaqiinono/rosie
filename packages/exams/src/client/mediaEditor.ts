'use client'

import { createUserSessionStore } from '@rosie/core'
import type { ExamMediaEditor } from '../types/media'
import { examRequest } from './examApi'

const stores = new Map<string, ReturnType<typeof createUserSessionStore<ExamMediaEditor | null>>>()

export function clearSavedExamMediaCache(userId: string, revisionId: string) {
  const requests: Promise<void>[] = []
  for (const [key, store] of stores) {
    if (!key.startsWith(`${revisionId}:`)) continue
    store.replaceSessionData(userId, null)
    store.invalidate(userId)
    requests.push(store.ensureLoaded(userId))
  }
  return Promise.all(requests)
}

export function examMediaEditorStore(revisionId: string, bindingRevisionId: string | null) {
  const key = `${revisionId}:${bindingRevisionId ?? 'unbound'}`
  let store = stores.get(key)
  if (!store) {
    store = createUserSessionStore<ExamMediaEditor | null>(`exam-media-editor:${key}`, {
      empty: null, fetch: userId => examRequest(userId, `/api/baidu/sync/exams?revisionId=${encodeURIComponent(revisionId)}`),
    })
    stores.set(key, store)
  }
  return store
}
