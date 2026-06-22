'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface LoginModalProps {
  onClose: () => void
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (tab === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else onClose()
    } else {
      const { error } = await signUp(email, password, email)
      if (error) setError(error)
      else { setError(null); setTab('login') }
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[15px] font-bold text-text-primary">
            {tab === 'login' ? '☁️ 登录账户' : '☁️ 注册账户'}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg leading-none">✕</button>
        </div>

        <div className="mb-4 rounded-lg bg-app-blue-light p-3 text-xs text-app-blue-dark">
          登录后练习记录和错题本会自动云端同步，换设备不丢失。
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-lg bg-gray-100 p-0.5">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 rounded-md py-1.5 text-[13px] font-semibold transition-all ${
                tab === t ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'
              }`}
            >
              {t === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border-light px-3 py-2 text-sm outline-none focus:border-app-blue"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-border-light px-3 py-2 text-sm outline-none focus:border-app-blue"
          />
          {error && (
            <div className="rounded-lg bg-[#fee2e2] px-3 py-2 text-xs text-[#dc2626]">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-app-blue py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {loading ? '请稍候…' : tab === 'login' ? '登录' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
