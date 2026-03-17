'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { STORAGE_KEYS } from '@/utils/constant'
import { useLocalStorage } from '@/hooks/useLocalStorage'

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
  const [solved, setSolved] = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.GUIYI_SOLVED, {})
  const [toast, setToast] = useState<string | null>(null)
  const [showCongrats, setShowCongrats] = useState(false)

  const handleSolve = useCallback(
    (id: string) => {
      if (!solved[id]) {
        setSolved(prev => ({ ...prev, [id]: true }))
        setShowCongrats(true)
      }
    },
    [solved, setSolved],
  )

  return (
    <Lesson35Context.Provider value={{ solved, handleSolve, toast, setToast, showCongrats, setShowCongrats }}>
      {children}
    </Lesson35Context.Provider>
  )
}
