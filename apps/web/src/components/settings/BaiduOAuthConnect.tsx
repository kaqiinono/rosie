'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isAdminUser, supabase, useAuth } from '@rosie/core'
import type { BaiduOAuthTarget } from '@/lib/baidu-oauth'

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '当前登录凭证未通过验证，请退出后重新登录。',
  auth_config_error: '服务端缺少登录验证配置，请检查 Supabase 环境变量。',
  auth_unavailable: '服务端暂时无法连接登录验证服务，请检查服务端网络后重试。',
  forbidden: '需要管理员权限，请重新登录管理员账户后重试。',
  config_error: '百度网盘授权配置未完成，请检查服务端 AppKey、SecretKey 和回调地址。',
  origin_mismatch: '当前网站与配置的回调地址不一致，请在对应网站发起授权。',
  storage_error: '授权记录暂时无法保存，请确认数据库迁移和服务端配置已完成后重试。',
  invalid_state: '本次授权已过期或失效，请重新点击授权百度网盘。',
  cancelled: '百度授权未完成，可以重新发起授权。',
  exchange_failed: '未能取得网盘授权，请确认应用权限和密钥后重新授权。',
  identity_failed: '未能获取百度网盘账户信息，请重新授权。',
}

type Props = { target: BaiduOAuthTarget; children?: ReactNode }

export default function BaiduOAuthConnect({ target, children }: Props) {
  const { user } = useAuth()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const personal = target === 'personal'
  const canAuthorize = !!user && (personal || isAdminUser(user))

  useEffect(() => {
    if (!canAuthorize) return
    const url = new URL(window.location.href)
    const result = url.searchParams.get('baidu_oauth')
    if (!result) return
    setSuccess(result === 'success')
    setMessage(result === 'success' ? (personal ? '你的百度网盘已绑定。' : '百度网盘授权已保存。') : (
      ERROR_MESSAGES[result] ?? '授权未完成，请重新发起授权。'
    ))
    url.searchParams.delete('baidu_oauth')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [canAuthorize, personal])

  async function authorize() {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setMessage('')
    setSuccess(false)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session || data.session.user.id !== user?.id) {
        throw new Error(ERROR_MESSAGES.unauthorized)
      }
      const endpoint = personal ? '/api/baidu/oauth/personal/start' : '/api/baidu/oauth/start'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      const payload: unknown = await response.json()
      if (!payload || typeof payload !== 'object') throw new Error('授权服务暂时不可用，请重试。')
      const result = payload as Record<string, unknown>
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error(typeof result.error === 'string'
          ? ERROR_MESSAGES[result.error] ?? '授权服务暂时不可用，请重试。'
          : '授权服务暂时不可用，请重试。')
      }
      const destination = new URL(result.url)
      if (destination.origin !== 'https://openapi.baidu.com' ||
        destination.pathname !== '/oauth/2.0/authorize') {
        throw new Error('授权地址无效，请重试。')
      }
      window.location.assign(destination.toString())
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        setMessage('授权接口响应超时，请检查本地服务端到登录验证服务的连接。')
      } else if (error instanceof SyntaxError) {
        setMessage('授权接口返回了异常响应，请查看本地服务端的错误日志。')
      } else {
        setMessage(error instanceof Error && Object.values(ERROR_MESSAGES).includes(error.message)
          ? error.message : '无法连接授权服务，请检查网络后重试。')
      }
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  if (!canAuthorize) return null

  return (
    <section key={user?.id} id="baidu-oauth" aria-labelledby="baidu-oauth-title"
      className="mt-5 scroll-mt-20 rounded-3xl border border-blue-200 bg-white/85 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="baidu-oauth-title" className="text-[16px] font-extrabold text-slate-800">
            {personal ? '我的百度网盘' : '共享百度网盘'}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {personal ? '将你的百度网盘绑定到当前 Rosie 账户。' : '连接存放公共课文音频、数学视频和共享物料的网盘。'}
          </p>
        </div>
        <button type="button" onClick={() => void authorize()} disabled={pending} aria-busy={pending}
          className="min-h-11 min-w-40 shrink-0 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60">
          {pending ? '正在前往百度…' : '授权百度网盘'}
        </button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true"
        className={`mt-3 min-h-5 text-[13px] leading-relaxed ${success ? 'text-emerald-700' : 'text-red-700'}`}>
        {message}
      </p>
      {children}
    </section>
  )
}
