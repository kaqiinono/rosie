'use client'

import { IconButton } from '@rosie/ui/themes'
import { useMathFavoritesContext } from '@rosie/math-kit/components/MathFavoritesProvider'
import ProblemActionIcon from './ProblemActionIcon'

type FavoriteHeartProps = {
  problemId: string
  size?: 'sm' | 'md'
  variant?: 'default' | 'toolbar'
}

export default function FavoriteHeart({
  problemId,
  size = 'md',
  variant = 'default',
}: FavoriteHeartProps) {
  const { isFavorite, toggleFavorite } = useMathFavoritesContext()
  const fav = isFavorite(problemId)
  const dim = size === 'sm' ? 'h-7 w-7 text-lg' : 'h-9 w-9 text-xl'

  if (variant === 'toolbar') {
    return (
      <IconButton
        type="button"
        size="2"
        variant="ghost"
        radius="full"
        color={fav ? 'amber' : 'gray'}
        aria-pressed={fav}
        aria-label={fav ? '取消收藏' : '收藏'}
        title={fav ? '取消收藏' : '收藏'}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          toggleFavorite(problemId)
        }}
      >
        <ProblemActionIcon name="heart" filled={fav} />
      </IconButton>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={fav}
      aria-label={fav ? '取消收藏' : '收藏'}
      title={fav ? '取消收藏' : '收藏这道题'}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(problemId)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          toggleFavorite(problemId)
        }
      }}
      className={`flex ${dim} shrink-0 cursor-pointer items-center justify-center rounded-full leading-none transition-transform duration-150 ease-out select-none hover:scale-110 active:scale-75`}
    >
      <span className={fav ? '' : 'opacity-70'}>{fav ? '❤️' : '🤍'}</span>
    </span>
  )
}
