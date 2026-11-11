'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Button, Switch, Text } from '@rosie/ui/themes'
import { SUBJECTS, type SubjectKey } from '../data'
import type { OrganicTreeApi } from './OrganicTimeTreeScene'

const OrganicTimeTreeScene = dynamic(() => import('./OrganicTimeTreeScene'), {
  ssr: false,
  loading: () => <LoadingOverlay visible placement="content" />,
})

const SUBJECT_KEYS: SubjectKey[] = ['chinese', 'math', 'english', 'life']

const SUBJECT_COLOR = { chinese: 'red', math: 'amber', english: 'blue', life: 'teal' } as const

export default function OrganicTimeTreeDemo() {
  const [api, setApi] = useState<OrganicTreeApi | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const [showBubbles, setShowBubbles] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)

  return (
    <PageShell
      title="时间成长树 · 有机材质"
      icon="🌳"
      subtitle="Perlin 木纹 · 玉石 SSS · 泡泡形变 · 0 点年轮 · 抛物线落果"
      backHref="/dev-preview/time-tree"
      width="wide"
    >
      <div className="flex flex-col gap-4">
        <StickerCard as="section" size="none" elevation="lg" className="overflow-hidden">
          <div className="h-[68vh] min-h-[460px] w-full touch-none">
            <OrganicTimeTreeScene
              showHistory={showHistory}
              showBubbles={showBubbles}
              resetSignal={resetSignal}
              onApi={setApi}
            />
          </div>
        </StickerCard>

        <StickerCard as="section" size="md" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!api} onClick={() => api?.rollover()}>
              🌙 0 点结算
            </Button>
            <Button variant="soft" disabled={!api} onClick={() => api?.newDay()}>
              🌱 新的一天
            </Button>
            <Text size="2" color="gray">
              先结算，等涟漪散去再点「新的一天」
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Text size="2" weight="bold">
              摘苹果
            </Text>
            {SUBJECT_KEYS.map((key) => (
              <Button
                key={key}
                variant="soft"
                color={SUBJECT_COLOR[key]}
                disabled={!api}
                onClick={() => api?.pluck(key)}
              >
                {SUBJECTS[key].label} → {SUBJECTS[key].stone}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button variant="soft" color="gray" onClick={() => setResetSignal((n) => n + 1)}>
              回正视角
            </Button>
            <Text as="label" size="2" weight="bold" className="flex items-center gap-2">
              <Switch checked={showHistory} onCheckedChange={setShowHistory} />
              显示历史枝
            </Text>
            <Text as="label" size="2" weight="bold" className="flex items-center gap-2">
              <Switch checked={showBubbles} onCheckedChange={setShowBubbles} />
              显示泡泡
            </Text>
            <Text size="2" color="gray" className="ml-auto">
              拖动旋转，双指或滚轮缩放
            </Text>
          </div>
        </StickerCard>
      </div>
    </PageShell>
  )
}
