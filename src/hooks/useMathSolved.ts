'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { STORAGE_KEYS } from '@/utils/constant'

function loadLocal(): Record<string, number> {
  try {
    const item = window.localStorage.getItem(STORAGE_KEYS.GUIYI_SOLVED)
    if (!item) return {}
    const parsed = JSON.parse(item)
    // Migrate old format: { "P1": true } → { "P1": 1 }
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'boolean') {
        result[k] = v ? 1 : 0
      } else if (typeof v === 'number') {
        result[k] = v
      }
    }
    return result
  } catch {
    return {}
  }
}

function saveLocal(data: Record<string, number>) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.GUIYI_SOLVED, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function useMathSolved(user: User | null) {
  const [solveCount, setSolveCount] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) {
      setSolveCount(loadLocal())
      return
    }
    supabase
      .from('math_solved')
      .select('problem_id, solve_count')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const record: Record<string, number> = {}
          data.forEach(row => { record[row.problem_id] = row.solve_count ?? 1 })
          setSolveCount(record)
          saveLocal(record)
        }
      })
  }, [user])

  // Returns the new count after incrementing
  const handleSolve = useCallback(async (id: string): Promise<number> => {
    if (!user) {
      return new Promise(resolve => {
        setSolveCount(prev => {
          const newCount = (prev[id] ?? 0) + 1
          const next = { ...prev, [id]: newCount }
          saveLocal(next)
          resolve(newCount)
          return next
        })
      })
    }

    const { data, error } = await supabase.rpc('increment_math_solved', {
      p_user_id: user.id,
      p_prob_id: id,
    })

    if (!error && typeof data === 'number') {
      setSolveCount(prev => {
        const next = { ...prev, [id]: data }
        saveLocal(next)
        return next
      })
      return data
    }

    // Fallback: local increment
    return new Promise(resolve => {
      setSolveCount(prev => {
        const newCount = (prev[id] ?? 0) + 1
        const next = { ...prev, [id]: newCount }
        saveLocal(next)
        resolve(newCount)
        return next
      })
    })
  }, [user])

  return { solveCount, handleSolve }
}
