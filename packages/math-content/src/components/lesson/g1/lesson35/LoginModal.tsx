'use client'

import { useState } from 'react'
import { useAuth } from '@rosie/core'
import { StickerCard } from '@rosie/ui'
import { Button, IconButton, TextField } from '@rosie/ui/themes'

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
      else {
        setError(null)
        setTab('login')
      }
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <StickerCard size="lg" elevation="lg" radius="md" className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-text-primary text-[15px] font-bold">
            {tab === 'login' ? '☁️ 登录账户' : '☁️ 注册账户'}
          </div>
          <IconButton onClick={onClose} variant="ghost" color="gray" size="3">
            ✕
          </IconButton>
        </div>

        <div className="bg-app-blue-light text-app-blue-dark mb-4 rounded-lg p-3 text-xs">
          登录后练习记录和错题本会自动云端同步，换设备不丢失。
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-lg bg-gray-100 p-0.5">
          {(['login', 'register'] as const).map((t) => (
            <Button
              key={t}
              onClick={() => {
                setTab(t)
                setError(null)
              }}
              variant={tab === t ? 'outline' : 'ghost'}
              color="gray"
              size="2"
              className="flex-1"
            >
              {t === 'login' ? '登录' : '注册'}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <TextField.Root
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            size="2"
            className="w-full"
          />
          <TextField.Root
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            size="2"
            className="w-full"
          />
          {error && (
            <div className="rounded-lg bg-[#fee2e2] px-3 py-2 text-xs text-[#dc2626]">{error}</div>
          )}
          <Button
            type="submit"
            disabled={loading}
            variant="solid"
            color="blue"
            size="2"
            className="w-full"
          >
            {loading ? '请稍候…' : tab === 'login' ? '登录' : '注册'}
          </Button>
        </form>
      </StickerCard>
    </div>
  )
}
