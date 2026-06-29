'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { useMathFavorites } from '@rosie/math/hooks/useMathFavorites'

export interface MathFavoritesContextValue {
  favorites: Set<string>
  isFavorite: (problemId: string) => boolean
  toggleFavorite: (problemId: string) => void
}

const MathFavoritesContext = createContext<MathFavoritesContextValue>({
  favorites: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => {},
})

export function MathFavoritesProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useAuth()
  const value = useMathFavorites(user)
  return <MathFavoritesContext.Provider value={value}>{children}</MathFavoritesContext.Provider>
}

export function useMathFavoritesContext(): MathFavoritesContextValue {
  return useContext(MathFavoritesContext)
}
