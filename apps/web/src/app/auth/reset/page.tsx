'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@rosie/core'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash — wait for session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('两次密码不一致')
      return
    }
    if (password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      await supabase.auth.signOut()
      router.replace('/auth?reset=success')
    }
    setLoading(false)
  }

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)',
        }}
      >
        <p className="text-sm text-white/40">正在验证链接…</p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)',
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🔑</div>
          <h1 className="text-2xl font-bold text-white">设置新密码</h1>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-white/[.05] p-6 font-sans">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] font-medium text-white/50">新密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/[.1] bg-white/[.06] px-4 py-2.5 text-[0.9rem] text-white placeholder-white/20 transition-colors outline-none focus:border-indigo-400/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] font-medium text-white/50">确认密码</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再输一次"
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/[.1] bg-white/[.06] px-4 py-2.5 text-[0.9rem] text-white placeholder-white/20 transition-colors outline-none focus:border-indigo-400/50"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-[0.82rem] text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full cursor-pointer rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 py-2.5 text-[0.9rem] font-semibold text-white shadow-lg transition-all hover:-translate-y-px disabled:cursor-default disabled:opacity-50"
            >
              {loading ? '保存中…' : '保存新密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
