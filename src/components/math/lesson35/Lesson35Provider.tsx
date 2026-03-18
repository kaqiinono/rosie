'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useMathSolved } from '@/hooks/useMathSolved'

interface Lesson35ContextType {
  solved: Record<string, boolean>
  handleSolve: (id: string) => void
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
  const { solved, handleSolve: solveAndSync } = useMathSolved(user)
  const [toast, setToast] = useState<string | null>(null)
  const [showCongrats, setShowCongrats] = useState(false)

  const handleSolve = (id: string) => {
    if (!solved[id]) {
      solveAndSync(id)
      setShowCongrats(true)
    }
  }

  return (
    <Lesson35Context.Provider value={{ solved, handleSolve, toast, setToast, showCongrats, setShowCongrats }}>
      {children}
    </Lesson35Context.Provider>
  )
}
