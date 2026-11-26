'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { useHomeworkData } from '@rosie/tasks'
import { Check, CircleMinus, StickerCard } from '@rosie/ui'
import { Button, Checkbox, Flex, IconButton, SegmentedControl, Switch, Text, Tooltip } from '@rosie/ui/themes'
import { bubbleSubject } from '@/components/tree-demo/garden/model'
import { cycleAvailableFrom, homeworkCycleKey, isClosedHomeworkCycle, isMultiweekCycle } from '@/lib/time-tree/cycleHomework'
import { isWeeklyPartialReceipt, weeklyHomeworkStart } from '@/lib/time-tree/flowers'
import { previewPractice } from '@/lib/time-tree/practicePreview'
import { dayOf, isInstantHomework, timeZone, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { homeworkCardSummary } from './homeworkCardSummary'
import { StepPanel } from './StepPanel'
import type { TreeController } from './useTimeTree'

const monthDay = new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'long', day: 'numeric' })
const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'short' })
const subjectTone = { english: 'sky', math: 'violet', chinese: 'peach', life: 'mint' } as const

type QuickAction = 'complete' | 'skip'

function canQuickAct(step: WorkStep, today: string) {
  if (step.start || step.end || step.skipped || !step.planned) return false
  if (step.subject === 'life') return step.scheduled === today
  return !homeworkCycleKey(step) || (!isClosedHomeworkCycle(step, today) && cycleAvailableFrom(step) <= today)
}

function taskOrder(step: WorkStep) {
  return step.end ? 2 : step.start ? 0 : 1
}

function usesCycleDeadline(step: WorkStep) {
  const [, cycle] = step.occurrence.split('/')
  return step.subject !== 'life' && (cycle === 'weekly' || isMultiweekCycle(cycle))
}

export default function HomeworkChecklist({ api, tree, onFinished }: {
  api: TreeController
  tree: TreeData
  onFinished: (step: WorkStep) => void
}) {
  const { steps, today } = tree
  const [view, setView] = useState<'today' | 'pending'>('today')
  const [showHabits, setShowHabits] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [saving, setSaving] = useState<{ action: QuickAction; batch: boolean } | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; error?: true } | null>(null)
  const submitting = useRef(false)
  const activeFilter = useRef<HTMLButtonElement>(null)
  const batchToolbar = useRef<HTMLDivElement>(null)
  const listId = useId()
  const { data: homework } = useHomeworkData()
  const templates = useMemo(() => new Map(homework.map(item => [item.id, item])), [homework])
  const { todaySteps, pendingSteps, runningOccurrences, pendingPartCounts } = useMemo(() => {
    const runningOccurrences = new Set<string>()
    const pendingPartCounts = new Map<string, number>()
    for (const step of steps) {
      if (step.end || step.skipped) continue
      if (step.start) runningOccurrences.add(step.occurrence)
      pendingPartCounts.set(step.occurrence, (pendingPartCounts.get(step.occurrence) ?? 0) + 1)
    }
    return {
      todaySteps: steps.filter(step => {
        if (step.skipped || isWeeklyPartialReceipt(step) || (!showHabits && step.subject === 'life')) return false
        if (!usesCycleDeadline(step)) return step.planned === today
        if (step.end) return step.planned === today || dayOf(step.end) === today
        if (!step.planned || step.deadline < today) return false
        return step.planned === today || (step.planned < today && (!!step.start || cycleAvailableFrom(step) <= today))
      }).sort((a, b) => taskOrder(a) - taskOrder(b)),
      pendingSteps: steps.filter(step => step.subject !== 'life' && !step.skipped && !step.end &&
        step.planned && (usesCycleDeadline(step) ? step.deadline < today : step.planned < today))
        .sort((a, b) => (a.planned ?? '').localeCompare(b.planned ?? '')),
      runningOccurrences,
      pendingPartCounts,
    }
  }, [steps, today, showHabits])

  const cards = (view === 'today' ? todaySteps : pendingSteps).map(step => {
    const eligible = canQuickAct(step, today)
    return { step, canComplete: eligible && !step.flowers, canSkip: eligible && !runningOccurrences.has(step.occurrence) }
  })
  const selected = cards.filter(({ step, canComplete, canSkip }) => selectedIds.has(step.id) && (canComplete || canSkip))
  const selectedSteps = selected.map(card => card.step)
  const canCompleteSelected = selected.length > 0 && selected.every(card => card.canComplete)
  const canSkipSelected = selected.length > 0 && selected.every(card => card.canSkip)
  const hasSelectedSplit = selectedSteps.some(step => (pendingPartCounts.get(step.occurrence) ?? 0) > 1)
  const busy = api.busy || !!saving
  const detail = steps.find(step => step.id === detailId)
  const emptyMessage = view === 'pending' ? '没有待办作业。'
    : showHabits ? '今天没有排入作业。' : '今天没有学科作业。'

  function cardButtonId(id: string) {
    return `${listId}-${id}`
  }

  function restoreFocus(id?: string) {
    requestAnimationFrame(() => {
      const target = id ? document.getElementById(cardButtonId(id)) : batchToolbar.current
      (target ?? activeFilter.current)?.focus({ preventScroll: true })
    })
  }

  async function save(targets: WorkStep[], action: QuickAction, batch = false) {
    if (busy || submitting.current || !targets.length) return
    submitting.current = true
    setSaving({ action, batch })
    setFeedback(null)
    const targetIds = new Set(targets.map(step => step.id))
    const processed = new Set<string>()
    try {
      for (const step of targets) {
        if (processed.has(step.id)) continue
        const kind = action === 'skip' ? 'skip' : step.subject === 'life' || isInstantHomework(step) ? 'pop' : 'completeUntimed'
        const result = await api.run({ kind, id: step.id })
        const saved = result?.steps.find(item => item.id === step.id)
        if (!result || !saved || !(action === 'skip' ? saved.skipped : saved.end)) {
          const progress = batch ? `已处理 ${processed.size}/${targets.length} 项。` : ''
          setFeedback({ text: `${progress}「${step.name}」保存失败，请重试。`, error: true })
          return
        }
        const affectedIds = action === 'skip' ? result.steps
          .filter(item => item.occurrence === step.occurrence && item.skipped).map(item => item.id) : [step.id]
        for (const id of affectedIds) {
          if (targetIds.has(id)) processed.add(id)
        }
        setSelectedIds(current => {
          const next = new Set(current)
          for (const id of affectedIds) next.delete(id)
          return next
        })
        if (!batch && action === 'complete') onFinished(saved)
      }
      if (batch) {
        setFeedback({ text: action === 'complete' ? `已完成 ${processed.size} 项作业。` : `已标记 ${processed.size} 项作业不用做。` })
      }
    } finally {
      submitting.current = false
      setSaving(null)
      restoreFocus(batch ? undefined : targets[0].id)
    }
  }

  return (
    <>
      <Flex align="center" gap={{ initial: '2', sm: '3' }} className="min-w-0 overflow-x-auto px-0.5 py-1 whitespace-nowrap">
        <SegmentedControl.Root size={{ initial: '1', sm: '2' }} className="shrink-0" aria-label="作业清单" value={view} disabled={busy}
          onValueChange={value => {
            if ((value === 'today' || value === 'pending') && value !== view) {
              setView(value)
              setSelectedIds(new Set())
              setFeedback(null)
            }
          }}>
          <SegmentedControl.Item value="today" ref={view === 'today' ? activeFilter : undefined}>今日作业</SegmentedControl.Item>
          <SegmentedControl.Item value="pending" ref={view === 'pending' ? activeFilter : undefined}>
            待办作业 {pendingSteps.length}
          </SegmentedControl.Item>
        </SegmentedControl.Root>
        {view === 'today' && (
          <Flex asChild align="center" gap="2" flexShrink="0">
            <label>
              <Switch aria-label="显示习惯" checked={showHabits} disabled={busy} onCheckedChange={checked => {
                setShowHabits(checked)
                if (!checked) {
                  setSelectedIds(current => {
                    const next = new Set(current)
                    for (const step of todaySteps) {
                      if (step.subject === 'life') next.delete(step.id)
                    }
                    return next
                  })
                }
              }} />
              <Text size="2">显示习惯</Text>
            </label>
          </Flex>
        )}
        {(selected.length > 0 || saving?.batch) && (
          <Flex ref={batchToolbar} tabIndex={-1} align="center" gap="2" className="ml-auto shrink-0"
            role="group" aria-label="批量处理作业">
            <Text size="2" role="status">已选 {selected.length} 项</Text>
            <Button type="button" size={{ initial: '1', sm: '2' }} color="green" disabled={busy || !canCompleteSelected}
              loading={saving?.batch && saving.action === 'complete'} onClick={() => void save(selectedSteps, 'complete', true)}>
              批量完成
            </Button>
            <Button type="button" size={{ initial: '1', sm: '2' }} variant="soft" color="gray" disabled={busy || !canSkipSelected}
              loading={saving?.batch && saving.action === 'skip'} onClick={() => void save(selectedSteps, 'skip', true)}>
              批量不用做
            </Button>
          </Flex>
        )}
      </Flex>
      {selected.length > 0 && !busy && (
        <>
          {!canCompleteSelected && <Text size="2" color="gray">所选含需在详情完成的作业。</Text>}
          {!canSkipSelected && <Text size="2" color="gray">所选含无法标记「不用做」的作业。</Text>}
          {canSkipSelected && hasSelectedSplit && <Text size="2" color="gray">对拆分作业标记「不用做」会处理本次所有未完成分段。</Text>}
        </>
      )}
      {feedback && !detail && <Text size="2" color={feedback.error ? 'red' : 'green'} role={feedback.error ? 'alert' : 'status'}>
        {feedback.text}{feedback.error && api.message && ` ${api.message}`}
      </Text>}
      {!feedback && !saving && !detail && api.message && <Text size="2" color="red" role="alert">{api.message}</Text>}
      {cards.length > 0 ? (
        <ul aria-label={view === 'today' ? '今日作业' : '待办作业'}
          className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3">
          {cards.map(({ step, canComplete, canSkip }) => {
            const complete = !!step.end
            const selectable = canComplete || canSkip
            const parts = pendingPartCounts.get(step.occurrence) ?? 0
            const skipLabel = parts > 1 ? `本次作业未完成的 ${parts} 段都不用做` : '本次作业不用做'
            const date = new Date(`${step.planned}T12:00:00Z`)
            const duration = `${weeklyHomeworkStart(step) ? '周目标' : '预计'} ${step.minutes} 分钟`
            const template = templates.get(step.occurrence.split('/')[0])
            const preview = previewPractice(tree, step, template)
            const summary = homeworkCardSummary(preview, step.scheduled)
            const words = summary?.wordGroups[0]
            const content = summary?.labels[0] || [words?.scope, words?.words.slice(0, 3).join('、')].filter(Boolean).join('，') ||
              step.notes.trim() || step.planNote?.trim()
            return (
              <StickerCard as="li" key={step.id} tone={subjectTone[step.subject]} size="none" elevation="sm" radius="md" interactive
                className="flex min-w-0 items-start gap-1 p-2">
                <label className={`grid size-10 shrink-0 place-items-center ${selectable && !busy ? 'cursor-pointer' : 'cursor-default'}`}>
                  <Checkbox size="3" checked={selectable && selectedIds.has(step.id)} disabled={busy || !selectable}
                    aria-label={`选择${step.name}，${monthDay.format(date)}`}
                    onCheckedChange={checked => setSelectedIds(current => {
                      const next = new Set(current)
                      if (checked === true) next.add(step.id)
                      else next.delete(step.id)
                      return next
                    })} />
                </label>
                {/* native-ok: 多行卡片正文有独立详情入口，悬停反馈由 StickerCard 提供。 */}
                <button type="button" id={cardButtonId(step.id)}
                  aria-haspopup="dialog" disabled={busy} onClick={() => setDetailId(step.id)}
                  className="flex min-h-10 min-w-0 flex-1 cursor-pointer flex-col items-stretch self-stretch rounded-xl px-1.5 py-1 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-8)] disabled:cursor-default">
                  <Text as="span" size="3" weight="bold" className="block wrap-anywhere">{step.name}</Text>
                  <Text as="span" size="2" color="gray" className="block wrap-anywhere">
                    <time dateTime={step.planned ?? undefined}>{monthDay.format(date)}（{weekday.format(date)}）</time> · {duration}
                  </Text>
                  {content && <Text as="span" size="2" color="gray" className="line-clamp-2 wrap-anywhere">
                    {bubbleSubject(step).label} · {content}
                  </Text>}
                </button>
                {(complete || canComplete || canSkip) && <Flex align="center" gap="1" className="shrink-0 pt-1">
                  {complete && <span className="grid size-8 place-items-center text-[var(--green-11)]" role="img" aria-label="已完成">
                    <Check size={19} aria-hidden="true" />
                  </span>}
                  {canComplete && <Tooltip content="完成">
                    <IconButton type="button" size="2" variant="ghost" color="green" disabled={busy}
                      aria-label={`完成${step.name}`} className="size-8" style={{ boxSizing: 'border-box', margin: 0 }} onClick={() => void save([step], 'complete')}>
                      <Check size={19} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>}
                  {canSkip && <Tooltip content={skipLabel}>
                    <IconButton type="button" size="2" variant="ghost" color="gray" disabled={busy}
                      aria-label={`${step.name}，${skipLabel}`} className="size-8" style={{ boxSizing: 'border-box', margin: 0 }} onClick={() => void save([step], 'skip')}>
                      <CircleMinus size={19} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>}
                </Flex>}
              </StickerCard>
            )
          })}
        </ul>
      ) : (
        <Text size="2" color="gray">{emptyMessage}</Text>
      )}
      {detail && <StepPanel key={detail.id} api={api} step={detail} select={setDetailId} close={() => {
        setDetailId(null)
        restoreFocus(detail.id)
      }} onFinished={onFinished} homework />}
    </>
  )
}
