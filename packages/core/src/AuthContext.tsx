'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, recoveryEmail: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null
      // Preserve the same User object reference when the id is unchanged (e.g.
      // TOKEN_REFRESHED) to avoid re-triggering [user]-dependent effects.
      setUser(prev => (prev?.id === next?.id ? prev : next))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
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
    try { localStorage.clear() } catch { /* ignore */ }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
