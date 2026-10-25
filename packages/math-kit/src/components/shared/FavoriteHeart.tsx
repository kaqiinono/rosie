'use client'

import { useMathFavoritesContext } from '@rosie/math-kit/components/MathFavoritesProvider'
import ProblemActionIcon, { PROBLEM_ACTION_BUTTON_CLASS } from './ProblemActionIcon'

type FavoriteHeartProps = {
  problemId: string
  size?: 'sm' | 'md'
  variant?: 'default' | 'toolbar'
}

export default function FavoriteHeart({ problemId, size = 'md', variant = 'default' }: FavoriteHeartProps) {
  const { isFavorite, toggleFavorite } = useMathFavoritesContext()
  const fav = isFavorite(problemId)
  const dim = size === 'sm' ? 'h-7 w-7 text-lg' : 'h-9 w-9 text-xl'

  if (variant === 'toolbar') {
    return (
      <button
        type="button"
        aria-pressed={fav}
        aria-label={fav ? '取消收藏' : '收藏'}
        title={fav ? '取消收藏' : '收藏'}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(problemId) }}
        className={`${PROBLEM_ACTION_BUTTON_CLASS} ${fav ? 'text-app-blue-dark' : 'text-text-secondary'}`}
      >
        <ProblemActionIcon name="heart" filled={fav} />
      </button>
    )
  }

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
