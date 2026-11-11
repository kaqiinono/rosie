'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@rosie/core'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { SyncPending } from './SyncControls'

export async function request<T>(userId: string, url: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw Error('请重新登录。')
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'PUT', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]), body: JSON.stringify(body),
  })
  const result = await res.json()
  if (!res.ok) throw Error(result?.error || '读取失败，请重试。')
  return result
}

export function useQuery<T>(userId: string, url: string) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ userId: string; url: string; attempt: number; data?: T; error?: string }>()
  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    void request<T>(userId, url, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ userId, url, attempt, data })
    }).catch((e: Error) => {
      if (!controller.signal.aborted) setResult({ userId, url, attempt, error: e.message })
    })
    return () => controller.abort()
  }, [url, attempt, userId])
  const current = result?.userId === userId && result.url === url && result.attempt === attempt ? result : undefined
  return { data: current?.data, error: current?.error, loading: Boolean(url && !current), retry: () => setAttempt(n => n + 1) }
}

export function LoadStatus({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (loading) return <SyncPending />
  if (error) return <Flex align="center" gap="2"><Text role="alert" size="2" color="red">{error}</Text><Button variant="soft" onClick={retry}>重试</Button></Flex>
  return null
}
