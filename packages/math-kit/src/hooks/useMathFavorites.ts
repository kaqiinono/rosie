'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'

async function fetchMathFavorites(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('math_favorites')
    .select('problem_id')
    .eq('user_id', userId)
  return new Set((data ?? []).map((r) => r.problem_id))
}

export const mathFavoritesStore = createUserSessionStore<Set<string>>('math_favorites', {
  fetch: fetchMathFavorites,
  empty: new Set<string>(),
})

export function useMathFavorites(user: User | null) {
  const { data: favorites } = mathFavoritesStore.useSessionData(user)

  const isFavorite = useCallback(
    (problemId: string) => favorites.has(problemId),
    [favorites],
  )

  const toggleFavorite = useCallback(
    (problemId: string) => {
      if (!user) return
      const willAdd = !favorites.has(problemId)
      mathFavoritesStore.patchSessionData(user.id, (prev) => {
        const next = new Set(prev)
        if (willAdd) next.add(problemId)
        else next.delete(problemId)
        return next
      })
      if (willAdd) {
        void supabase
          .from('math_favorites')
          .upsert(
            { user_id: user.id, problem_id: problemId },
            { onConflict: 'user_id,problem_id' },
          )
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] insert error:', error)
              mathFavoritesStore.patchSessionData(user.id, (prev) => {
                const n = new Set(prev)
                n.delete(problemId)
                return n
              })
            }
          })
      } else {
        void supabase
          .from('math_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('problem_id', problemId)
          .then(({ error }) => {
            if (error) {
              console.error('[math_favorites] delete error:', error)
              mathFavoritesStore.patchSessionData(user.id, (prev) => {
                const n = new Set(prev)
                n.add(problemId)
                return n
              })
            }
          })
      }
    },
    [user, favorites],
  )

  return { favorites, isFavorite, toggleFavorite }
}
