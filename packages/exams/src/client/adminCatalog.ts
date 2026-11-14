'use client'

import { createUserSessionStore } from '@rosie/core'
import type { ExamContentSet } from '../types/content'
import { examRequest } from './examApi'

export interface AdminExamItem {
  contentSetId: string
  revisionId: string
  revision: number
  title: string
  source: { id: string; title: string }
  kind: ExamContentSet['kind']
  purpose: ExamContentSet['purpose']
  status: 'draft' | 'published' | 'withdrawn'
  version: string
  createdAt: string
  updatedAt: string
}

interface AdminCatalogPage { items: AdminExamItem[]; page: number; pageSize: number; hasMore: boolean }
const stores = new Map<string, ReturnType<typeof createUserSessionStore<AdminCatalogPage>>>()

export function adminCatalogStore(status: AdminExamItem['status'], page: number) {
  const key = `${status}:${page}`
  let store = stores.get(key)
  if (!store) {
    store = createUserSessionStore<AdminCatalogPage>(`exams-admin:${key}`, {
      empty: { items: [], page, pageSize: 25, hasMore: false },
      fetch: userId => examRequest(userId, `/api/admin/exams/catalog?status=${status}&page=${page}&pageSize=25`),
    })
    stores.set(key, store)
  }
  return store
}

export function patchAdminExamTitle(userId: string, id: string, title: string, version: string) {
  for (const store of stores.values()) store.patchSessionData(userId, previous => ({ ...previous,
    items: previous.items.map(item => item.revisionId === id ? { ...item, title, version } : item) }))
}

export function refreshAdminCatalog(userId: string) {
  return Promise.all([...stores.values()].map(store => store.refreshInBackground(userId)))
}

export function clearSavedExamCatalogCache(userId: string, revisionId: string) {
  const requests: Promise<void>[] = []
  for (const store of stores.values()) {
    const snapshot = store.getSnapshot(userId)
    if (!snapshot.data.items.some(item => item.revisionId === revisionId)) continue
    store.replaceSessionData(userId, { ...snapshot.data, items: [] })
    store.invalidate(userId)
    requests.push(store.ensureLoaded(userId))
  }
  return Promise.all(requests)
}
