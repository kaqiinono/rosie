'use client'

import { useState } from 'react'
import { ImmersiveProvider, useAuth } from '@rosie/core'
import { englishWeeklyPlansStore, WeeklyPlanSession, WordsProvider, useWordsContext } from '@rosie/english'
import type { PracticeEntryRow } from '@rosie/tasks'
import { DarkScope, LoadingOverlay } from '@rosie/ui'
import { Button, Flex, Select, Text } from '@rosie/ui/themes'
import { weeklyPlanForDate, weeklyPlanPracticeTarget } from './weeklyPlanPractice'

function PlanPractice({ planId, date }: { planId?: string; date: string }) {
  const { user } = useAuth()
  const { vocab, entryScopeReady, entryScopeError } = useWordsContext()
  const { data: plans, isLoading, error } = englishWeeklyPlansStore.useSessionData(user)
  const [retrying, setRetrying] = useState(false)
  const plan = planId ? plans.find(item => item.id === planId) : weeklyPlanForDate(plans, date)

  if (!user) return <Text>请先登录。</Text>
  if (error || (planId && !isLoading && !plan)) return <Flex direction="column" gap="3" p="4">
    <Text role="alert">{error ? '暂时无法读取多日计划。' : '找不到绑定的多日计划，计划可能已删除。'}</Text>
    <Button variant="soft" loading={retrying} onClick={async () => {
      setRetrying(true)
      try { await englishWeeklyPlansStore.refreshInBackground(user.id) } catch { /* The store exposes the error. */ }
      finally { setRetrying(false) }
    }}>重试读取计划</Button>
  </Flex>
  if (isLoading || (plan && !entryScopeReady && !entryScopeError)) return <Flex position="relative" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex>
  if (!plan) return <Text role="status" as="p" className="p-4">这一天没有安排单词。</Text>
  const day = plan.days.find(item => item.date === date)
  if (!day) return <Text role="alert">计划中已没有作业绑定的日期（{date}），请在作业设置中更新内容。</Text>
  if (!day.newWordKeys.length) return <Text>这一天没有安排单词。</Text>
  if (entryScopeError) return <Text role="alert">词库读取失败，请关闭后重试。</Text>
  return <WeeklyPlanSession key={plan.id} initialPlan={plan} vocab={vocab} startDate={date} autoStart embedded onBack={() => {}} />
}

type PracticeItem = { row?: PracticeEntryRow | null; href?: string | null }

export default function HomeworkWeeklyPlanPractice({ items = [], dailyDate, disabled = false }: (
  { items: PracticeItem[]; dailyDate?: never } | { items?: never; dailyDate: string }
) & {
  disabled?: boolean
}) {
  const choices = items.flatMap(item => {
    const target = weeklyPlanPracticeTarget(item)
    return target ? [{ ...target, key: item.row?.id ?? `${target.planId}:${target.date}`, label: item.row?.label ?? target.date }] : []
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = choices.find(item => item.key === selectedKey) ?? choices[0]
  const target = dailyDate ? { planId: undefined, date: dailyDate } : selected
  if (!target) return null
  return <Flex direction="column" gap="3" width="100%" minWidth="0">
    {selected && choices.length > 1 && <Select.Root value={selected.key} onValueChange={setSelectedKey} disabled={disabled}>
      <Select.Trigger aria-label="选择本次作业的计划练习" className="w-full" />
      <Select.Content>{choices.map((item, index) => <Select.Item key={item.key} value={item.key}>第 {index + 1} 项 · {item.label}</Select.Item>)}</Select.Content>
    </Select.Root>}
    <div className="w-full min-w-0" inert={disabled || undefined}>
      <WordsProvider vocabScope="all">
        <ImmersiveProvider>
          <DarkScope>
            <div className="w-full min-w-0" style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}>
              <PlanPractice key={`${target.planId ?? 'daily'}:${target.date}`} planId={target.planId} date={target.date} />
            </div>
          </DarkScope>
        </ImmersiveProvider>
      </WordsProvider>
    </div>
  </Flex>
}
