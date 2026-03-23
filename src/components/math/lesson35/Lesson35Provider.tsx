'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMathSolved } from '@/hooks/useMathSolved'
import { supabase } from '@/lib/supabase'

interface Lesson35ContextType {
  solveCount: Record<string, number>
  solved: Record<string, boolean>
  handleSolve: (id: string) => void
  wrongIds: Set<string>
  addWrong: (id: string) => void
  removeWrong: (id: string) => void
  toast: string | null
  setToast: (msg: string | null) => void
  showCongrats: boolean
  setShowCongrats: (v: boolean) => void
}

const Lesson35Context = createContext<Lesson35ContextType | null>(null)

export function useLesson35() {
  const ctx = useContext(Lesson35Context)
  if (!ctx) throw new Error('useLesson35 must be used within Lesson35Provider')
  return ctx
}

export default function Lesson35Provider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { solveCount, handleSolve: solveAndSync } = useMathSolved(user)
  const [toast, setToast] = useState<string | null>(null)
  const [showCongrats, setShowCongrats] = useState(false)
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_wrong')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setWrongIds(new Set(data.map(r => r.problem_id)))
      })
  }, [user])

  const solved: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(solveCount)) {
    if (v >= 1) solved[k] = true
  }

  const handleSolve = async (id: string) => {
    const newCount = await solveAndSync(id)

    setWrongIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      if (user) {
        supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', id)
      }
      return next
    })

    if (newCount === 1) {
      setShowCongrats(true)
    } else if (newCount === 2) {
      setToast('💪 第2次答对！再练一次就掌握了！')
    } else if (newCount === 3) {
      setToast('🏆 已掌握！答对3次，厉害！')
    } else {
      setToast(`⭐ 第${newCount}次答对！继续保持！`)
    }
  }

  const addWrong = useCallback((id: string) => {
    setWrongIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      if (user) {
        supabase.from('math_wrong').upsert(
          { user_id: user.id, problem_id: id },
          { onConflict: 'user_id,problem_id' },
        )
      }
      return next
    })
  }, [user])

  const removeWrong = useCallback((id: string) => {
    setWrongIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      if (user) {
        supabase.from('math_wrong').delete().eq('user_id', user.id).eq('problem_id', id)
      }
      return next
    })
  }, [user])

  return (
    <Lesson35Context.Provider value={{
      solveCount, solved, handleSolve,
      wrongIds, addWrong, removeWrong,
      toast, setToast, showCongrats, setShowCongrats,
    }}>
      {children}
    </Lesson35Context.Provider>
  )
}
