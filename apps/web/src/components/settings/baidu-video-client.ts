'use client'

import { supabase } from '@rosie/core'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'

type Read = { action: 'read'; lessonKey: string; directoryId?: string }
type Mutation = {
  lessonKey: string; directoryId: string | null; generation: string; version: string | null
} & ({ action: 'sync' } | { action: 'save'; revision: string | null; picks: Record<string,string> })
export type VideoRequest = Read | Mutation

export async function requestBaiduVideoData(userId: string, input: VideoRequest, signal: AbortSignal): Promise<MathVideoEditor> {
  const { data, error } = await supabase.auth.getSession()
  if (error || data.session?.user.id !== userId) throw Error('登录已过期，请重新登录。')
  const query = new URLSearchParams({ lessonKey: input.lessonKey })
  if (input.directoryId) query.set('directoryId', input.directoryId)
  const route = input.action === 'sync' ? 'sync' : 'report'
  const response = await fetch('/api/baidu/video/catalog/' + route + '?' + query, {
    method: input.action === 'read' ? 'GET' : input.action === 'sync' ? 'POST' : 'PUT',
    headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
    body: input.action === 'read' ? undefined : JSON.stringify(input),
    credentials: 'same-origin', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(input.action === 'sync' ? 300_000 : 30_000)]),
  })
  const result = await response.json()
  if (!response.ok) throw Error(typeof result?.error === 'string' ? result.error : '请求失败，请重试。')
  if (result?.lessonKey !== input.lessonKey || !Array.isArray(result.bindings) || !Array.isArray(result.problems))
    throw Error('读取结果异常，请重新读取。')
  return result as MathVideoEditor
}

export const VIDEO_SECONDARY_BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-light bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue disabled:cursor-not-allowed disabled:opacity-50'
