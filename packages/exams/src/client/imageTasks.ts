'use client'
import { useEffect, useState } from 'react'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { ExamImageWorkspace } from '../types/imageTasks'
import type { AdminExamItem } from './adminCatalog'
import { examRequest, ExamRequestError, examErrorMessage } from './examApi'

export const imageCatalogStore = createUserSessionStore<{ items: AdminExamItem[] }>('exams-image-catalog', {
  empty: { items: [] }, fetch: async userId => {
    const items: AdminExamItem[] = []
    for (let page = 1; page <= 100; page++) {
      const data = await examRequest<{ items: AdminExamItem[]; hasMore: boolean }>(userId, `/api/admin/exams/catalog?status=draft&page=${page}&pageSize=100`)
      items.push(...data.items)
      if (!data.hasMore) return { items }
    }
    throw new ExamRequestError('exam_catalog_too_large', 413)
  },
})
const stores = new Map<string, ReturnType<typeof createUserSessionStore<ExamImageWorkspace | null>>>()

export function clearSavedExamImageCache(userId: string, revisionId: string) {
  const requests: Promise<void>[] = []
  const workspace = stores.get(revisionId)
  if (workspace) {
    workspace.replaceSessionData(userId, null)
    workspace.invalidate(userId)
    requests.push(workspace.ensureLoaded(userId))
  }
  if (imageCatalogStore.getSnapshot(userId).data.items.some(item => item.revisionId === revisionId)) {
    imageCatalogStore.replaceSessionData(userId, { items: [] })
    imageCatalogStore.invalidate(userId)
    requests.push(imageCatalogStore.ensureLoaded(userId))
  }
  return Promise.all(requests)
}

export function imageWorkspaceStore(revisionId: string) {
  let store = stores.get(revisionId)
  if (!store) {
    store = createUserSessionStore<ExamImageWorkspace | null>(`exams-images:${revisionId}`, {
      empty: null, fetch: userId => examRequest(userId, `/api/admin/exams/images/workspace?revisionId=${encodeURIComponent(revisionId)}`),
    })
    stores.set(revisionId, store)
  }
  return store
}

/** Binary originals never enter a persisted client cache. Account changes revoke their blob URLs. */
export async function imageRequest(userId: string, url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
  const signal = AbortSignal.any([AbortSignal.timeout(180_000), ...(init.signal ? [init.signal] : [])])
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  const response = await fetch(url, { ...init, headers, signal, cache: 'no-store', redirect: 'error' })
  if ((await supabase.auth.getSession()).data.session?.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new ExamRequestError(body.error ?? 'exam_unavailable', response.status)
  }
  return response
}

export function useExamImageBlob(userId: string, url: string | null, revision = '') {
  const key = url ? `${url}|${revision}` : null
  const [state, setState] = useState<{ request: string | null; url: string | null; error: unknown }>({ request: null, url: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    if (url) void imageRequest(userId, url, { signal: controller.signal }).then(response => response.blob()).then(blob => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setState({ request: key, url: objectUrl, error: null })
    }).catch(error => { if (!controller.signal.aborted) setState({ request: key, url: null, error }) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [userId, url, key])
  return state.request === key ? { ...state, loading: !!url && !state.url && !state.error }
    : { url: null, error: null, loading: !!url }
}

export function imageTaskError(error: unknown): string {
  const code = error instanceof ExamRequestError ? error.code : error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    exam_image_busy: '上一笔提交仍在处理中，请稍后重试原操作。',
    exam_image_review_changed: '这张图片或审核标记已变化，请重新读取后再确认。',
    exam_image_source_missing: '尚未准备这道题的原书页，请先补充来源页。',
    exam_image_task_removed: '此裁切任务已删除，请重新读取任务列表。成品题图与绑定保留。',
    exam_image_source_changed: '原书页已更新，请重新读取后再裁切。',
    exam_image_storage_unavailable: '图片任务存储暂不可用，请确认任务迁移已应用后重试。',
    exam_image_upload_failed: '上传未完成，当前裁图仍保留。请重试；若持续失败，请确认共享百度账号有目标目录的写入权限。',
    exam_image_file_conflict: '目标文件与本次裁图不同，已停止覆盖。请重新读取后处理。',
    exam_image_too_large: '裁图超过4 MiB，请缩小选区后重新提交。',
    exam_image_directory_invalid: '考试上传目录配置不正确，请配置 BAIDU_EXAMS_UPLOAD_ROOT。',
    baidu_reauthorize: '共享百度授权失效，请在同步管理重新授权后重试。',
    baidu_account_changed: '共享百度账号已变更，请重新读取任务后再提交。',
  }
  return messages[code] ?? examErrorMessage(error)
}
