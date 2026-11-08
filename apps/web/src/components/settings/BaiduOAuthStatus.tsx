'use client'

import { useState } from 'react'
import { BAIDU_AUTH_MESSAGES, createUserSessionStore, supabase, useAuth } from '@rosie/core'
import { LinkButton } from '@rosie/ui'

interface Status { state: string; expiresAt: string | null; checkedAt?: string }
async function readStatus(userId: string, method: 'GET' | 'POST'): Promise<Status> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw Error('请重新登录 Rosie 后检查授权。')
  const response = await fetch('/api/baidu/oauth/status', {
    method, cache: 'no-store', headers: { Authorization: `Bearer ${data.session.access_token}` },
    signal: AbortSignal.timeout(60_000),
  })
  if (response.status === 401) throw Error('Rosie 登录已失效，请重新登录。')
  if (response.status === 403) throw Error('仅管理员可检查共享授权。')
  if (!response.ok) throw Error('暂时无法确认授权状态，请检查网络和服务端配置后重试。')
  const result: Status = await response.json()
  const current = await supabase.auth.getSession()
  if (current.data.session?.user.id !== userId) throw Error('登录账户已变更，请重新检查。')
  return result
}
const store = createUserSessionStore<Status | null>('baidu_shared_oauth_status', {
  empty: null, fetch: userId => readStatus(userId, 'GET'),
})
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })

export default function BaiduOAuthStatus() {
  const { user } = useAuth()
  const { data, error, isLoading } = store.useSessionData(user)
  const [pending, setPending] = useState(false)
  const [checkError, setCheckError] = useState('')
  async function check() {
    if (!user || pending || isLoading) return
    setPending(true)
    setCheckError('')
    try { store.replaceSessionData(user.id, await readStatus(user.id, 'POST')) }
    catch (cause) { setCheckError(cause instanceof Error ? cause.message : '暂时无法检查授权，请稍后重试。') }
    finally { setPending(false) }
  }
  const failed = checkError || (error instanceof Error ? error.message : '')
  return <div className="mt-3 space-y-1 text-sm text-text-secondary">
    <p role="status" aria-live="polite">{pending ? '正在检查授权…' : failed || (isLoading ? '正在读取授权记录…' : data?.state === 'valid'
      ? '最近检查：授权有效' : data?.state === 'unchecked' ? '已有授权记录，尚未在线检查' : BAIDU_AUTH_MESSAGES[data?.state ?? ''] ?? '授权状态未知')}</p>
    {data?.expiresAt && <p>访问凭证到期时间：{time(data.expiresAt)}（北京时间）</p>}
    {data?.checkedAt && <p>上次检查：{time(data.checkedAt)}（北京时间）</p>}
    <p>访问资源时会自动续期，凭证到期不代表需要手动授权；无法续期时再重新授权。</p>
    <LinkButton onClick={() => { void check() }}>{pending ? '检查中…' : '检查授权'}</LinkButton>
  </div>
}
