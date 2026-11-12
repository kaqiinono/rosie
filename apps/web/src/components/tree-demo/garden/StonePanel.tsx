'use client'

import type { ReactNode } from 'react'
import clsx from 'clsx'
import { StickerCard } from '@rosie/ui'
import { Badge, Button, Progress, Text } from '@rosie/ui/themes'
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
  canExchange: boolean
  onExchange: () => void
  /** 面板在手机上放在屏幕底部（横向铺满）时，三堆石头改为一行三列 */
  bottomOnMobile?: boolean
  /** 仅手机底部布局显示：并入「绿松石 / 换心愿」那一行的额外操作按钮，省去单独的卡片 */
  mobileActions?: ReactNode
  registerPile: (key: SubjectKey, el: HTMLElement | null) => void
}

const PROGRESS_COLOR: Record<CoreSubject, 'red' | 'amber' | 'blue'> = {
  chinese: 'red',
  math: 'amber',
  english: 'blue',
}

function Gem({ color, deep, glow }: { color: string; deep: string; glow: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`size-8 shrink-0 ${glow ? 'tg-gem-glow' : ''}`}
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

/** 树旁的石头坞：三堆石头各带进度，三堆都够 N 颗才能换心愿；绿松石只收藏 */
export default function StonePanel({
  state,
  thresholds,
  canExchange,
  onExchange,
  bottomOnMobile = false,
  mobileActions,
  registerPile,
}: Props) {
  const { stones, settings, remainder } = state
  return (
    <StickerCard tone="paper" size="sm" elevation="md" radius="md" className="w-full">
      <div className={clsx('grid gap-2 sm:gap-3', bottomOnMobile && 'max-md:grid-cols-3')}>
        {CORE_SUBJECTS.map((key) => {
          const meta = SUBJECTS[key]
          const count = stones[key]
          const enough = count >= settings.n
          const toNext = (thresholds?.[key] ?? settings.k) - remainder[key]
          return (
            <div
              key={key}
              ref={(el) => registerPile(key, el)}
              className="flex min-w-0 flex-col gap-1"
              title={`再开 ${toNext} 朵${meta.label}花，结下一个苹果`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Gem color={meta.color} deep={meta.deep} glow={enough} />
                <div className="min-w-10 flex-1">
                  <Text as="div" size="1" color="gray" weight="bold" truncate>
                    {meta.stone}
                  </Text>
                  <Text as="div" size="3" weight="bold">
                    {count} / {settings.n}
                  </Text>
                </div>
                {enough && (
                  <Badge color="green" variant="soft" radius="full" className="max-sm:hidden">
                    够啦
                  </Badge>
                )}
              </div>
              <Progress
                value={Math.min(count, settings.n)}
                max={settings.n}
                color={PROGRESS_COLOR[key]}
                size="2"
              />
              <Text as="div" size="1" color="gray" className="max-sm:hidden">
                再开 {toNext} 朵花结苹果
              </Text>
            </div>
          )
        })}
      </div>
      <div
        className={clsx(
          'mt-3 flex flex-col items-start gap-2',
          bottomOnMobile && 'max-md:mt-2 max-md:flex-row max-md:flex-wrap max-md:items-center',
        )}
      >
        <div
          ref={(el) => registerPile('life', el)}
          className={clsx('flex items-center gap-2', bottomOnMobile && 'max-md:mr-auto')}
          title="绿松石只收藏，不参与兑换"
        >
          <Gem color={SUBJECTS.life.color} deep={SUBJECTS.life.deep} glow={false} />
          <Text size="2" weight="bold">
            绿松石 {stones.life}
          </Text>
        </div>
        <Text size="1" color="gray" className="min-w-0 max-sm:hidden">
          红、黄、蓝都够 {settings.n} 颗才能换 · 已兑换 {state.exchanges} 次
        </Text>
        <Button size="2" disabled={!canExchange} onClick={onExchange}>
          🎁 换心愿
        </Button>
        {mobileActions && <div className="contents md:hidden">{mobileActions}</div>}
      </div>
    </StickerCard>
  )
}
