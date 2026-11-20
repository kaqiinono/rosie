'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, StickerCard } from '@rosie/ui'
import { isEarly } from '@/lib/time-tree/rewards'
import type { WorkStep } from '@/lib/time-tree/types'

export function useFlowerRewardToast(placement: 'top' | 'bottom' = 'bottom') {
  const [reward, showReward] = useState<WorkStep | null>(null)
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => showReward(null), 3000)
    return () => window.clearTimeout(timer)
  }, [reward])

  const top = placement === 'top'
  const position = top
    ? 'tg-toast top-[calc(env(safe-area-inset-top)+0.75rem)]'
    : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]'
  const toast = reward && createPortal(
    <div key={reward.id} role="status" className={`pointer-events-none fixed inset-x-2 z-[120] flex justify-center ${position}`}>
      <StickerCard size="sm" tone={top ? 'success' : 'white'} elevation={top ? 'sm' : 'md'} radius={top ? 'md' : 'lg'}>
        {top && (
          <div className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Check aria-hidden="true" className="size-5 shrink-0 rounded-full bg-green-600 p-0.5 text-white" />
            {reward.dailyRainbow ? '收获彩虹果！' : isEarly(reward) ? '提前完成，奖励翻倍！' : '完成啦！'}
          </div>
        )}
        <div className={`flex flex-wrap gap-x-3 tabular-nums ${top ? 'text-sm' : 'justify-center font-bold'}`}>
          <span><span aria-hidden="true">🌸</span><span className="sr-only">花朵</span> +{reward.stages.length}</span>
          <span><span aria-hidden="true">☀️</span><span className="sr-only">阳光</span> +{reward.sun}</span>
          <span><span aria-hidden="true">💧</span><span className="sr-only">水滴</span> +{reward.water}</span>
          {(!top || !!reward.tomatoes) && (
            <span><span aria-hidden="true">🍅</span><span className="sr-only">番茄</span> +{reward.tomatoes ?? 0}</span>
          )}
        </div>
      </StickerCard>
    </div>, document.body)
  return { toast, showReward }
}
