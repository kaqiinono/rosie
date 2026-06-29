'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'

export function useMathFavorites(user: User | null) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('math_favorites')
      .select('problem_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFavorites(new Set(data.map(r => r.problem_id)))
      })
  }, [user])

  const isFavorite = useCallback(
    (problemId: string) => favorites.has(problemId),
    [favorites],
  )

  const toggleFavorite = useCallback(
    (problemId: string) => {
      if (!user) return
      const willAdd = !favorites.has(problemId)
      // optimistic
      setFavorites(prev => {
        const next = new Set(prev)
        if (willAdd) next.add(problemId)
        else next.delete(problemId)
        return next
      })
      if (willAdd) {
        supabase
          .from('math_favorites')
          .upsert(
            { user_id: user.id, problem_id: problemId },
            { onConflict: 'user_id,problem_id' },
          )
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] insert error:', error)
              setFavorites(prev => { const n = new Set(prev); n.delete(problemId); return n })
            }
          })
      } else {
        supabase
          .from('math_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('problem_id', problemId)
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] delete error:', error)
              setFavorites(prev => { const n = new Set(prev); n.add(problemId); return n })
            }
          })
      }
    },
    [user, favorites],
  )

  return { favorites, isFavorite, toggleFavorite }
}
