'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@rosie/core'
import { Button, TextField } from '@rosie/ui/themes'

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
          background: '#1a1a2e',
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
        background: '#1a1a2e',
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
              <TextField.Root
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                required
                minLength={6}
                autoComplete="new-password"
                size="2"
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.8rem] font-medium text-white/50">确认密码</label>
              <TextField.Root
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再输一次"
                required
                autoComplete="new-password"
                size="2"
                className="w-full"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-[0.82rem] text-red-400">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              variant="solid"
              color="blue"
              size="2"
              className="mt-1 w-full"
            >
              {loading ? '保存中…' : '保存新密码'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
