'use client'

import { useMemo } from 'react'
import { useAuth, getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import { PageBreadcrumb, StickerCard } from '@rosie/ui'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathFavoritesContext } from '@rosie/math-kit/components/MathFavoritesProvider'
import {
  resolveFavoriteProblems,
  groupFavoritesByLesson,
} from '@rosie/math/utils/favorites-helpers'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import FavoriteHeart from '@rosie/math-kit/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math-kit/components/shared/PracticeCountBadge'
import { useStartPracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/useStartPracticeQueue'
import { seaPoolToQueueItems } from '@rosie/math-kit/utils/practice-queue-from-sea'
import { Button } from '@rosie/ui/themes'

export default function MathFavoritesPage() {
  const { user } = useAuth()
  const { practiceCount, correctCount } = useMathPracticeStats(user)
  const { favorites } = useMathFavoritesContext()
  const startPractice = useStartPracticeQueue()

  const favItems = useMemo(() => resolveFavoriteProblems(favorites), [favorites])
  const groups = useMemo(() => groupFavoritesByLesson(favItems), [favItems])
  const queuePool = useMemo(() => seaPoolToQueueItems(favItems), [favItems])

  const beginPractice = (initialProblemId?: string) => {
    if (queuePool.length === 0) return
    startPractice({
      pool: queuePool,
      source: 'favorites',
      title: '收藏练习',
      initialProblemId,
      returnHref: '/math/favorites',
    })
  }

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-5">
      <div className="w-fit">
        <PageBreadcrumb variant="inline" />
      </div>

      <div className="mt-3 mb-5 rounded-[14px] bg-rose-50 p-6">
        <h1 className="mb-1 text-2xl font-extrabold text-rose-700">我的收藏 ❤️</h1>
        <p className="text-[13px] text-rose-600/80">
          收藏了 <strong>{favItems.length}</strong> 道好题，挑出来反复练吧！
        </p>
        {favItems.length > 0 && (
          <Button
            type="button"
            onClick={() => beginPractice()}
            variant="solid"
            color="ruby"
            size="2"
            className="mt-3"
          >
            ▶ 开始连刷
          </Button>
        )}
      </div>

      {favItems.length === 0 ? (
        <StickerCard size="lg" elevation="sm" radius="md" className="text-center">
          <div className="mb-3 text-5xl">🌟</div>
          <div className="text-text-primary text-base font-bold">还没有收藏的题目</div>
          <div className="text-text-muted mt-1 text-[13px]">
            在任意题目卡片点 🤍 就能把好题收藏到这里
          </div>
        </StickerCard>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.lessonId}>
              <div className="text-text-secondary mb-2 flex items-center gap-1.5 text-[13px] font-bold">
                {SEA_LESSON_MAP[group.lessonId]?.icon} {group.title}
                <span className="text-text-muted">· {group.items.length} 题</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((sp) => {
                  const count = practiceCount[sp.problem.id] ?? 0
                  const level = getMasteryLevel(correctCount[sp.problem.id] ?? 0)
                  return (
                    <StickerCard
                      asChild
                      key={`${sp.lessonId}-${sp.section}-${sp.problem.id}`}
                      interactive
                      size="sm"
                      elevation="sm"
                      radius="md"
                    >
                      <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
                        type="button"
                        onClick={() => beginPractice(sp.problem.id)}
                        className="flex w-full items-center gap-2.5 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-text-primary text-[13px] font-semibold">
                            {sp.problem.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <PracticeCountBadge count={count} />
                          </div>
                        </div>
                        <div className="text-xl">{MASTERY_ICON[level]}</div>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <FavoriteHeart problemId={sp.problem.id} size="sm" />
                        </div>
                      </button>
                    </StickerCard>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
