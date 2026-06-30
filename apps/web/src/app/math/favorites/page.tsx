'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth, getMasteryLevel, MASTERY_ICON } from '@rosie/core'
import { BackLink } from '@rosie/ui'
import { useMathSolved } from '@rosie/math/hooks/useMathSolved'
import { useMathFavoritesContext } from '@rosie/math/components/MathFavoritesProvider'
import {
  resolveFavoriteProblems,
  groupFavoritesByLesson,
} from '@rosie/math/utils/favorites-helpers'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import FavoriteHeart from '@rosie/math/components/shared/FavoriteHeart'
import PracticeCountBadge from '@rosie/math/components/shared/PracticeCountBadge'
import ProblemPracticeSession, { FAVORITES_SKIN } from '@rosie/math/components/shared/ProblemPracticeSession'

export default function MathFavoritesPage() {
  const { user } = useAuth()
  const { solveCount, solvedAt, handleSolve } = useMathSolved(user)
  const { favorites } = useMathFavoritesContext()
  const [practiceMode, setPracticeMode] = useState(false)

  const favItems = useMemo(() => resolveFavoriteProblems(favorites), [favorites])
  const groups = useMemo(() => groupFavoritesByLesson(favItems), [favItems])

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <BackLink href="/math" label="返回数学" />

      <div className="mb-5 mt-2 rounded-[14px] bg-gradient-to-br from-rose-50 to-pink-100 p-6">
        <h1 className="mb-1 text-2xl font-extrabold text-rose-700">我的收藏 ❤️</h1>
        <p className="text-[13px] text-rose-600/80">
          收藏了 <strong>{favItems.length}</strong> 道好题，挑出来反复练吧！
        </p>
        {favItems.length > 0 && (
          <button
            onClick={() => setPracticeMode(true)}
            className="mt-3 cursor-pointer rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-transform active:scale-95"
          >
            ▶ 开始连刷
          </button>
        )}
      </div>

      {favItems.length === 0 ? (
        <div className="rounded-[14px] bg-white p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="mb-3 text-5xl">🌟</div>
          <div className="text-base font-bold text-text-primary">还没有收藏的题目</div>
          <div className="mt-1 text-[13px] text-text-muted">
            在任意题目卡片点 🤍 就能把好题收藏到这里
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.lessonId}>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-secondary">
                {SEA_LESSON_MAP[group.lessonId]?.icon} {group.title}
                <span className="text-text-muted">· {group.items.length} 题</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((sp) => {
                  const count = solveCount[sp.problem.id] ?? 0
                  const level = getMasteryLevel(count)
                  return (
                    <Link
                      key={`${sp.lessonId}-${sp.section}-${sp.problem.id}`}
                      href={sp.href}
                      className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-border-light bg-white p-3 no-underline shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-text-primary">{sp.problem.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          <PracticeCountBadge count={count} />
                        </div>
                      </div>
                      <div className="text-xl">{MASTERY_ICON[level]}</div>
                      <FavoriteHeart problemId={sp.problem.id} size="sm" />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {practiceMode && (
        <ProblemPracticeSession
          pool={favItems}
          poolMode="favorites"
          solveCount={solveCount}
          solvedAt={solvedAt}
          onSolve={handleSolve}
          onEnd={() => setPracticeMode(false)}
          skin={FAVORITES_SKIN}
        />
      )}
    </div>
  )
}
