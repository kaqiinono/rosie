'use client'

import { createUserSessionStore, refreshSessionStore } from '@rosie/core'
import { examRequest, ExamRequestError } from '../client/examApi'
import type { ExamResolvedWord, ExamWordReviewBatch, ExamWordReviewSummary } from '../types/vocabulary'

export const wordReviewListStore = createUserSessionStore<{ items: ExamWordReviewSummary[] }>('exam-word-review-list', {
  empty: { items: [] }, fetch: userId => examRequest(userId, '/api/exams/word-review'),
})
const batches = new Map<string, ReturnType<typeof createUserSessionStore<ExamWordReviewBatch | null>>>()
export function wordReviewBatchStore(id: string) {
  let store = batches.get(id)
  if (!store) {
    store = createUserSessionStore<ExamWordReviewBatch | null>(`exam-word-review:${id}`, { empty: null, fetch: userId => examRequest(userId, `/api/exams/word-review/${encodeURIComponent(id)}`) })
    batches.set(id, store)
  }
  return store
}
const links = new Map<string, ReturnType<typeof createUserSessionStore<{ items: ExamResolvedWord[] }>>>()
export function examWordLinksStore(attemptId: string) {
  let store = links.get(attemptId)
  if (!store) {
    store = createUserSessionStore<{ items: ExamResolvedWord[] }>(`exam-word-links:${attemptId}`, { empty: { items: [] }, fetch: userId => examRequest(userId, `/api/exams/word-review/links?attemptId=${encodeURIComponent(attemptId)}`) })
    links.set(attemptId, store)
  }
  return store
}
export async function saveWordReview(userId: string, path: string, command: Record<string, unknown>): Promise<ExamWordReviewBatch> {
  const batch = await examRequest<ExamWordReviewBatch>(userId, path, { method: 'POST', body: JSON.stringify(command) })
  wordReviewBatchStore(batch.id).patchSessionData(userId, () => batch)
  if (wordReviewListStore.getSnapshot(userId).status === 'ready') {
    wordReviewListStore.patchSessionData(userId, previous => ({ items: [
      { id: batch.id, version: batch.version, status: batch.status, count: batch.items.length, updatedAt: batch.updatedAt },
      ...previous.items.filter(item => item.id !== batch.id),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50) }))
  }
  if (batch.status === 'completed') {
    void Promise.allSettled(['exams-reports:14', 'exams-reports:28'].map(key => refreshSessionStore(key, userId)))
  }
  return batch
}
export function wordReviewError(error: unknown): string {
  if (error instanceof ExamRequestError) {
    if (error.code === 'exam_word_invalid') return '词条来源已经变化或失效，已停止补练，请返回来源复盘。'
    if (error.code === 'exam_word_batch_full') return '这批已有 10 个词，先开始这一批，再添加下一批。'
    if (error.code === 'exam_word_options_unavailable') return '当前词库不足以组成有效的词义选项，请稍后再试。'
    if (error.status === 401) return '登录已过期，请重新登录。'
    if (error.status === 404) return '找不到当前账号的这份来源或补练批次。'
    if (error.status === 409) return '进度已在别处更新，请重新读取后继续。'
  }
  return '保存未完成，当前输入仍保留。请重试保存。'
}
