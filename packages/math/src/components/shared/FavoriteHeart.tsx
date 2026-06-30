'use client'

import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'

type FavoriteHeartProps = {
  problemId: string
  size?: 'sm' | 'md'
}

export default function FavoriteHeart({ problemId, size = 'md' }: FavoriteHeartProps) {
  const { isFavorite, toggleFavorite } = useMathFavoritesContext()
  const fav = isFavorite(problemId)
  const dim = size === 'sm' ? 'h-7 w-7 text-lg' : 'h-9 w-9 text-xl'

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={fav}
      aria-label={fav ? '取消收藏' : '收藏'}
      title={fav ? '取消收藏' : '收藏这道题'}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(problemId)
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          toggleFavorite(problemId)
        }
      }}
      className={`flex ${dim} shrink-0 cursor-pointer select-none items-center justify-center rounded-full leading-none transition-transform duration-150 ease-out hover:scale-110 active:scale-75`}
    >
      <span className={fav ? '' : 'opacity-70'}>{fav ? '❤️' : '🤍'}</span>
    </span>
  )
}
