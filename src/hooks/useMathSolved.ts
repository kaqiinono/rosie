'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'

function loadLocal(): Record<string, boolean> {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.GUIYI_SOLVED)
    return item ? JSON.parse(item) : {}
  } catch {
    return {}
  }
}

function saveLocal(data: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.GUIYI_SOLVED, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function useMathSolved(user: User | null) {
  const [solved, setSolved] = useState<Record<string, boolean>>({})

  // Load on mount or user change
  useEffect(() => {
    if (!user) {
      setSolved(loadLocal())
      return
    }
    // Load from Supabase
    supabase
      .from('math_solved')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const record: Record<string, boolean> = {}
          data.forEach(row => { record[row.problem_id] = true })
          setSolved(record)
          saveLocal(record)
        }
      })
  }, [user])

  const handleSolve = useCallback(async (id: string) => {
    setSolved(prev => {
      if (prev[id]) return prev
      const next = { ...prev, [id]: true }
      saveLocal(next)
      return next
    })

    if (user) {
      await supabase
        .from('math_solved')
        .upsert({ user_id: user.id, problem_id: id }, { onConflict: 'user_id,problem_id' })
    }
  }, [user])

  return { solved, handleSolve }
}
