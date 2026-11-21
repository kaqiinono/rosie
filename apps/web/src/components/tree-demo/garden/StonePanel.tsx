'use client'

import type { ReactNode } from 'react'
import { StickerCard } from '@rosie/ui'
import { Button, Progress, Text } from '@rosie/ui/themes'
import {
  CORE_SUBJECTS,
  SUBJECTS,
  type CoreSubject,
  type GardenState,
  type SubjectKey,
} from './model'

type Props = {
  state: GardenState
  thresholds?: Record<CoreSubject, number>
  lifeThreshold: number
  canExchange: boolean
  busy: boolean
  onExchange: () => void
  onWishHint: (message: string | null) => void
  /** 仅手机底部布局显示的额外操作按钮。 */
  mobileActions?: ReactNode
  registerPile: (key: SubjectKey, el: HTMLElement | null) => void
}

const STONES: SubjectKey[] = [...CORE_SUBJECTS, 'life']
const PROGRESS_COLORS = { chinese: 'red', math: 'amber', english: 'blue', life: 'green' } as const
const STONE_LIST = new Intl.ListFormat('zh-CN', { type: 'conjunction' })

export function Gem({ color, deep }: { color: string; deep: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 3 L28 12 L23 28 H9 L4 12 Z"
        fill={color}
        stroke={deep}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 12 H28 M16 3 L12 12 L16 28 L20 12 Z"
        fill="none"
        stroke={deep}
        strokeWidth="1.4"
        opacity="0.55"
      />
      <ellipse
        cx="11"
        cy="9"
        rx="2.4"
        ry="1.4"
        fill="#ffffff"
        opacity="0.8"
        transform="rotate(-25 11 9)"
      />
    </svg>
  )
}

export default function StonePanel({
  state,
  thresholds,
  lifeThreshold,
  canExchange,
  busy,
  onExchange,
  onWishHint,
  mobileActions,
  registerPile,
}: Props) {
  const { stones, settings, remainder } = state
  const progress = STONES.map(key => {
    const target = key === 'life' ? lifeThreshold : settings.n
    const count = stones[key]
    return { key, target, count, missing: Math.max(0, target - count) }
  })
  const totalMissing = progress.reduce((total, item) => total + item.missing, 0)
  const wishLabel = canExchange ? '宝石已集齐！立即换心愿'
    : totalMissing > 0 ? `还差 ${totalMissing} 颗宝石，去集齐换心愿` : '查看下次兑换时间'
  const compactWishLabel = canExchange ? '换心愿' : totalMissing > 0 ? `还差 ${totalMissing} 颗` : '下次兑换'
  return (
    <StickerCard tone="paper" size="sm" elevation="md" radius="md" className="@container flex w-full flex-col">
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 @min-[28rem]:grid-cols-4">
        {progress.map(({ key, count, target, missing }) => {
          const meta = SUBJECTS[key]
          const nextFruit = key === 'life'
            ? '习惯养成得绿苹果'
            : `再开 ${(thresholds?.[key] ?? settings.k) - remainder[key]} 朵花结苹果`
          return (
            <div
              key={key}
              ref={(el) => registerPile(key, el)}
              className="flex min-w-0 flex-col gap-1"
              title={nextFruit}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Gem color={meta.color} deep={meta.deep} />
                <div className="min-w-10 flex-1">
                  <Text as="div" size="1" color="gray" weight="bold" truncate>
                    {meta.stone}
                  </Text>
                  <Text as="div" size="3" weight="bold">
                    {count} / {target}
                  </Text>
                </div>
              </div>
              <Progress
                aria-label={`${meta.stone}兑换进度`}
                value={Math.min(count, target)}
                max={target}
                color={PROGRESS_COLORS[key]}
                size="2"
                className="tg-stone-progress flex-none"
                data-stone-progress={missing === 0 ? 'full' : missing === 1 ? 'near' : undefined}
              />
              <Text as="div" size="1" color="gray" className="truncate max-sm:hidden">
                {nextFruit}
              </Text>
            </div>
          )
        })}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-3">
        {mobileActions && <div className="flex flex-wrap gap-2 md:hidden">{mobileActions}</div>}
        <Button size="3" color={canExchange ? 'amber' : 'gray'} variant={canExchange ? 'solid' : 'soft'}
          data-wish-ready={canExchange || undefined} className="tg-wish-button min-h-11 w-full min-w-0 whitespace-nowrap text-center"
          aria-label={wishLabel} title={wishLabel}
          disabled={busy} onClick={event => {
            if (canExchange) { onExchange(); return }
            const button = event.currentTarget
            button.classList.remove('tg-wish-hint')
            void button.offsetWidth
            button.classList.add('tg-wish-hint')
            const remaining = progress.filter(item => item.missing > 0)
              .map(({ key, missing }) => `${missing} 颗${SUBJECTS[key].stone}`)
            onWishHint(remaining.length ? `还差 ${STONE_LIST.format(remaining)}哦！` : null)
          }}>
          <span aria-hidden="true" className="truncate @min-[18rem]:hidden">{compactWishLabel}</span>
          <span aria-hidden="true" className="hidden truncate @min-[18rem]:block">
            {canExchange ? `🎉 ${wishLabel}` : `${wishLabel} ›`}
          </span>
        </Button>
      </div>
    </StickerCard>
  )
}
