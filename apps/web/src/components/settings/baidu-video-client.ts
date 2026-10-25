'use client'

import { supabase } from '@rosie/core'

export async function requestBaiduVideoData(
  action: 'sync' | 'report', userId: string, lessonKey: string, signal: AbortSignal, force = false,
): Promise<unknown> {
  const { data, error } = await supabase.auth.getSession()
  if (error || data.session?.user.id !== userId) throw new Error('登录已过期，请重新登录。')
  const query = action === 'report' ? `?lessonKey=${encodeURIComponent(lessonKey)}` : ''
  const response = await fetch(`/api/baidu/video/catalog/${action}${query}`, {
    method: action === 'sync' ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(action === 'sync' ? { 'Content-Type': 'application/json' } : {}) },
    body: action === 'sync' ? JSON.stringify({ lessonKey, force }) : undefined,
    credentials: 'same-origin', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(action === 'sync' ? 300_000 : 30_000)]),
  })
  if (response.status === 401) throw new Error('登录已过期，请重新登录。')
  if (response.status === 403) throw new Error('需要管理员权限。')
  if (response.status === 400) throw new Error('年级或讲次无效，请重新选择。')
  if (response.status === 502 && action === 'sync') throw new Error('网盘搜索结果不完整，未替换本讲旧清单。请检查本讲文件数量或稍后重试。')
  if (!response.ok) throw new Error(action === 'sync'
    ? '同步失败，旧清单未被本次失败替换。请检查百度授权、目录与数据库迁移后重试。'
    : '报告读取失败，请检查数据库迁移和网络后重试。')
  return response.json()
}

export function videoSyncTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value))
}

export const VIDEO_SECONDARY_BUTTON = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-border-light bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue disabled:cursor-not-allowed disabled:opacity-50'
