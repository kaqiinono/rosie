'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash — wait for session
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('两次密码不一致'); return }
    if (password.length < 6) { setError('密码至少 6 位'); return }
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
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)'
      }}>
        <p className="text-white/40 text-sm">正在验证链接…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)'
    }}>
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-white">设置新密码</h1>
        </div>

        <div className="bg-white/[.05] border border-white/[.08] rounded-2xl p-6 font-sans">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] text-white/50 font-medium">新密码</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 位" required minLength={6} autoComplete="new-password"
                className="w-full px-4 py-2.5 bg-white/[.06] border border-white/[.1] rounded-xl text-white placeholder-white/20 text-[0.9rem] outline-none focus:border-indigo-400/50 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] text-white/50 font-medium">确认密码</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="再输一次" required autoComplete="new-password"
                className="w-full px-4 py-2.5 bg-white/[.06] border border-white/[.1] rounded-xl text-white placeholder-white/20 text-[0.9rem] outline-none focus:border-indigo-400/50 transition-colors"
              />
            </div>
            {error && (
              <div className="text-red-400 text-[0.82rem] bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white text-[0.9rem] font-semibold cursor-pointer shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-default mt-1">
              {loading ? '保存中…' : '保存新密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
