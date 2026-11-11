'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isAuthError, type User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    recoveryEmail: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function formatSignInError(error: unknown): string {
  const authError = isAuthError(error) ? error : undefined
  const status = authError?.status
  let code = authError?.code ?? (status ? `HTTP_${status}` : 'login_failed')
  let message = '登录失败，请稍后重试'

  if (code === 'invalid_credentials') {
    message = '用户名或密码错误'
  } else if (code === 'over_request_rate_limit' || status === 429) {
    message = '登录请求过于频繁，请稍后再试'
  } else if (
    code === 'request_timeout' ||
    status === 408 ||
    status === 504 ||
    (error instanceof Error && error.name === 'TimeoutError')
  ) {
    message = '登录请求超时，请重试'
    if (code === 'login_failed') code = 'client_timeout'
  } else if (authError?.name === 'AuthRetryableFetchError' && status === 0) {
    message = '无法连接登录服务，请检查网络后重试'
    code = 'network_error'
  } else if (status && status >= 500) {
    message = '登录服务暂时不可用，请稍后再试'
  }

  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
  return `${message}（北京时间 ${time}，错误码 ${code}）`
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange emits an INITIAL_SESSION event on subscribe, so it
    // already delivers the current session — a separate getSession() call is
    // redundant and (because it does a raw setUser) creates a second `user`
    // object reference that re-fires every hook depending on [user].
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null
      // Preserve the same User object reference when the id is unchanged (e.g.
      // TOKEN_REFRESHED) to avoid re-triggering [user]-dependent effects.
      setUser((prev) => (prev?.id === next?.id && _event !== 'USER_UPDATED' ? prev : next))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ? formatSignInError(error) : null }
    } catch (error) {
      return { error: formatSignInError(error) }
    }
  }

  const signUp = async (email: string, password: string, recoveryEmail: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { recovery_email: recoveryEmail } },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    try {
      localStorage.clear()
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
