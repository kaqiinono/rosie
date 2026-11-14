'use client'

import { useAuth, type WeeklyPlan } from '@rosie/core'
import { fmtDate, useAdaptiveWordPlan, useWeeklyPlan } from '@rosie/english'
import { FlowRadioCards, LoadingOverlay } from '@rosie/ui'
import { Flex, RadioCards, Text } from '@rosie/ui/themes'
import type { PracticeEntryRow } from '@rosie/tasks'
import { adaptivePlanPracticePath, weeklyPlanPracticePath, weeklyPlanRows, weeklyPlanTitle } from './englishPlans'

type Commit = { path: string; rows: PracticeEntryRow[]; name: string }

function planSpan(plan: WeeklyPlan): { start: string; end: string; days: number } {
  const dates = plan.days.filter((day) => day.newWordKeys.length > 0).map((day) => day.date).sort()
  return { start: dates[0] ?? plan.weekStart, end: dates[dates.length - 1] ?? plan.weekStart, days: dates.length }
}

export default function EnglishPlanPicker({ disabled = false, onCommit }: { disabled?: boolean; onCommit: (entry: Commit) => void }) {
  const { user } = useAuth()
  const { allPlans, isLoading: plansLoading } = useWeeklyPlan(user)
  const { plans: adaptivePlans, isLoading: adaptiveLoading, error: adaptiveError } = useAdaptiveWordPlan(user)
  const loading = plansLoading || adaptiveLoading
  const weekly = [...allPlans].filter((plan) => plan.id).sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  const activeAdaptive = adaptivePlans.filter((plan) => plan.status === 'active')
  const pausedAdaptive = adaptivePlans.filter((plan) => plan.status === 'paused')

  function choose(value: string) {
    if (disabled || loading) return
    if (value.startsWith('weekly:')) {
      const plan = weekly.find((item) => item.id === value.slice('weekly:'.length))
      if (!plan?.id) return
      const rows = weeklyPlanRows(plan, [])
      if (!rows.length) return
      onCommit({ path: weeklyPlanPracticePath, rows, name: `${weeklyPlanTitle(plan)}英语计划`.slice(0, 120) })
      return
    }
    const plan = activeAdaptive.find((item) => item.id === value.slice('adaptive:'.length))
    if (!plan) return
    onCommit({ path: adaptivePlanPracticePath(plan.id), rows: [], name: plan.title.slice(0, 120) })
  }

  if (loading) return <Flex direction="column" minHeight="240px"><LoadingOverlay visible placement="content" /></Flex>
  return <Flex direction="column" gap="3">
    <Text size="2" color="gray">多日计划会按日期生成清单，做完一天再进入下一天。自适应计划没有清单，打开后直接练习。</Text>
    {!weekly.length && !activeAdaptive.length && <Text>还没有可以加入作业的英语计划。</Text>}
    {!!weekly.length && <Flex direction="column" gap="2">
      <Text size="2" weight="bold">多日计划</Text>
      <FlowRadioCards layout="flow" aria-label="多日计划" value="" onValueChange={choose}>
        {weekly.map((plan) => {
          const span = planSpan(plan)
          return <RadioCards.Item key={plan.id} value={`weekly:${plan.id}`} disabled={!span.days}>
            <Flex direction="column" gap="1" minWidth="0">
              <Text size="3" weight="bold" wrap="wrap">{weeklyPlanTitle(plan)}</Text>
              <Text size="2" color="gray">{fmtDate(span.start)} – {fmtDate(span.end)} · {span.days ? `${span.days} 天` : '还没有单词'}{plan.weekCompletion ? ' · 已结课' : ''}</Text>
            </Flex>
          </RadioCards.Item>
        })}
      </FlowRadioCards>
    </Flex>}
    {!!activeAdaptive.length && <Flex direction="column" gap="2">
      <Text size="2" weight="bold">自适应计划</Text>
      <FlowRadioCards layout="flow" aria-label="自适应计划" value="" onValueChange={choose}>
        {activeAdaptive.map((plan) => <RadioCards.Item key={plan.id} value={`adaptive:${plan.id}`}>
          <Flex direction="column" gap="1" minWidth="0">
            <Text size="3" weight="bold" wrap="wrap">{plan.title}</Text>
            <Text size="2" color="gray">直接进入练习，每天的词由计划自己安排</Text>
          </Flex>
        </RadioCards.Item>)}
      </FlowRadioCards>
    </Flex>}
    {!!pausedAdaptive.length && <Text size="2" color="gray">有 {pausedAdaptive.length} 个自适应计划已暂停，恢复后才能加入作业。</Text>}
    {adaptiveError != null && <Text role="alert" color="red">自适应计划读取失败，请稍后重试。</Text>}
  </Flex>
}
