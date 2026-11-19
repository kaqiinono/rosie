'use client'

import { useMemo, useState } from 'react'
import { BAIDU_AUTH_MESSAGES, createUserSessionStore, supabase, useAuth, type UserSessionStore } from '@rosie/core'

const stores = new Map<string, UserSessionStore<unknown | null>>()
const messages: Record<string, string> = {
  unauthorized: '登录已过期，请重新登录。', forbidden: '仅管理员可管理考试资源。',
  exam_conflict: '此版本已被修改，请重新读取后核对。', exam_not_editable: '只有草稿可以修改资源绑定。',
  baidu_account_changed: '共享账号已变化，请刷新授权路径后重新选择文件。',
  exam_invalid_media_binding: '请核对授权目录、文件类型和所选资源。',
  exam_media_binding_changed: '文件或绑定已变化，请刷新后重新选择。',
  exam_media_scope_conflict: '此文件混有其他可见范围，请预先裁剪成独立文件。',
  exam_media_file_missing: '文件已移动、删除或缺少可核对的元数据。',
  exam_media_binding_missing: '请先保存资源绑定。', exam_media_unavailable: '暂时无法读取考试资源，请稍后重试。',
}

export async function examSyncRequest<T>(userId: string, url: string, options: { method?: 'GET' | 'PUT' | 'POST'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw Error(messages.unauthorized)
  const response = await fetch(url, {
    method: options.method ?? 'GET', cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : ''
    throw Error(messages[code] ?? BAIDU_AUTH_MESSAGES[code] ?? '请求未完成，请稍后重试。')
  }
  if ((await supabase.auth.getSession()).data.session?.user.id !== userId) throw Error(messages.unauthorized)
  return result as T
}

export function useExamSyncQuery<T>(userId: string, url: string) {
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const store = useMemo(() => {
    let found = stores.get(url)
    if (!found) {
      found = createUserSessionStore<unknown | null>(`exam_sync:${url}`, { empty: null, fetch: id => examSyncRequest(id, url) })
      stores.set(url, found)
    }
    return found
  }, [url])
  const state = store.useSessionData(url && user?.id === userId ? user : null)
  return {
    data: state.data as T | null, loading: state.isLoading, refreshing,
    error: state.error instanceof Error ? state.error.message : '',
    replace: (data: T) => store.replaceSessionData(userId, data),
    refresh: async () => {
      setRefreshing(true)
      try { await store.refreshInBackground(userId) } finally { setRefreshing(false) }
    },
  }
}
