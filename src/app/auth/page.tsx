'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

function toEmail(username: string) {
  return `${username.trim().toLowerCase()}@rosie.app`
}

type View = 'login' | 'signup' | 'forgot'

export default function AuthPage() {
  return <Suspense><AuthContent /></Suspense>
}

function AuthContent() {
  const { signIn, signUp, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setMessage('密码已重置，请用新密码登录。')
    }
  }, [searchParams])

  if (user) {
    router.replace('/')
    return null
  }

  const reset = () => { setError(null); setMessage(null) }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); reset(); setLoading(true)
    const { error } = await signIn(toEmail(username), password)
    if (error) setError('用户名或密码错误')
    else router.replace('/')
    setLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); reset()
    if (!recoveryEmail.trim()) { setError('请填写恢复邮箱，用于找回密码'); return }
    setLoading(true)
    const { error } = await signUp(toEmail(username), password, recoveryEmail)
    if (error) {
      setError(error.includes('already') ? '该用户名已被注册' : error)
    } else {
      setMessage('注册成功！')
      setView('login')
    }
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); reset(); setLoading(true)
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, recoveryEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      window.location.href = data.actionLink
    } catch {
      setError('网络错误，请重试')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 font-sans"
      style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)' }}
    >
      <div className="w-[400px] max-w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌟</div>
          <h1 className="font-fredoka text-[2rem] text-white tracking-wide">Rosie 的学习乐园</h1>
          <p className="text-white/40 text-sm mt-1">登录后进度自动云端同步</p>
        </div>

        <div className="bg-white/[.05] border border-white/[.08] rounded-2xl p-6">

          {/* Tabs */}
          {view !== 'forgot' && (
            <div className="flex gap-1.5 mb-6 p-1 bg-white/[.04] rounded-xl">
              {(['login', 'signup'] as const).map(v => (
                <button key={v} onClick={() => { setView(v); reset() }}
                  className={`flex-1 py-2 rounded-lg text-[0.85rem] transition-all cursor-pointer ${
                    view === v
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {v === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>
          )}

          {/* LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Field label="用户名" value={username} onChange={setUsername} placeholder="输入你的用户名" autoComplete="username" />
              <Field label="密码" type="password" value={password} onChange={setPassword} placeholder="输入密码" autoComplete="current-password" minLength={6} />
              <Feedback error={error} message={message} />
              <SubmitBtn loading={loading} label="登录" />
              <button type="button" onClick={() => { setView('forgot'); reset() }}
                className="text-center text-[0.8rem] text-white/30 hover:text-white/50 transition-colors cursor-pointer pt-0.5">
                忘记密码？
              </button>
            </form>
          )}

          {/* SIGNUP */}
          {view === 'signup' && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <Field label="用户名" value={username} onChange={setUsername} placeholder="设置你的用户名" autoComplete="username" />
              <Field label="密码" type="password" value={password} onChange={setPassword} placeholder="至少 6 位" autoComplete="new-password" minLength={6} />
              <div className="flex flex-col gap-1">
                <Field label="恢复邮箱" type="email" value={recoveryEmail} onChange={setRecoveryEmail} placeholder="用于找回密码的真实邮箱" autoComplete="email" />
                <p className="text-[0.75rem] text-white/25 px-1">仅用于找回密码，登录时无需填写</p>
              </div>
              <Feedback error={error} message={message} />
              <SubmitBtn loading={loading} label="注册" />
            </form>
          )}

          {/* FORGOT */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <p className="text-white/70 text-[0.9rem] font-medium mb-1">找回密码</p>
              <Field label="用户名" value={username} onChange={setUsername} placeholder="你的用户名" autoComplete="username" />
              <Field label="注册时填写的恢复邮箱" type="email" value={recoveryEmail} onChange={setRecoveryEmail} placeholder="your@email.com" autoComplete="email" />
              <Feedback error={error} message={message} />
              <SubmitBtn loading={loading} label="验证并重置密码" />
              <button type="button" onClick={() => { setView('login'); reset() }}
                className="text-center text-[0.8rem] text-white/30 hover:text-white/50 transition-colors cursor-pointer pt-0.5">
                ← 返回登录
              </button>
            </form>
          )}
        </div>

        <button onClick={() => router.replace('/')}
          className="w-full mt-4 py-2.5 text-white/25 text-[0.8rem] hover:text-white/45 transition-colors cursor-pointer">
          暂不登录，继续使用本地模式
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, autoComplete, minLength }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; autoComplete?: string; minLength?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.8rem] text-white/50 font-medium">{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required autoComplete={autoComplete} minLength={minLength}
        className="w-full px-4 py-2.5 bg-white/[.06] border border-white/[.1] rounded-xl text-white placeholder-white/20 text-[0.9rem] outline-none focus:border-indigo-400/50 transition-colors"
      />
    </div>
  )
}

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) return (
    <div className="text-red-400 text-[0.82rem] bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5 leading-snug">
      {error}
    </div>
  )
  if (message) return (
    <div className="text-green-400 text-[0.82rem] bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-2.5 leading-snug">
      {message}
    </div>
  )
  return null
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white text-[0.9rem] font-semibold cursor-pointer shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-default mt-1">
      {loading ? '请稍候…' : label}
    </button>
  )
}
