'use client'

import { dayPlanMinutes, flowerQuestionProgress, isWeeklyPartialReceipt, weeklyHomeworkStart } from '@/lib/time-tree/flowers'
import { useMemo, useRef, useState } from 'react'
import { useHomeworkData } from '@rosie/tasks'
import { AppDialog, ChevronDown, LearningIcon, StatTile, StickerCard, type LearningIconName } from '@rosie/ui'
import { Badge, Button, Flex, Text, TextField } from '@rosie/ui/themes'
import { bubbleSubject, type SubjectKey } from '@/components/tree-demo/garden/model'
import { dayOf, timing, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { previewPractice } from '@/lib/time-tree/practicePreview'
import TaskLearningContent from './TaskLearningContent'

type Props = {
  tree: TreeData
  days: string[]
  onClose: () => void
  onSelect: (id: string) => void
  onPop: (id: string) => void
  onAdd: (day: string, name: string, id: string) => Promise<boolean>
  busy: boolean
  message: string
}

const WEEKDAYS = '日一二三四五六'
const SUBJECT_ICON = {
  chinese: 'focus',
  math: 'calculator',
  english: 'wordCards',
  life: 'plan',
} satisfies Record<SubjectKey, LearningIconName>
const CHIP: Record<SubjectKey, string> = {
  chinese: 'bg-red-100',
  math: 'bg-amber-100',
  english: 'bg-blue-100',
  life: 'bg-green-100',
}
const ACTION_COLOR = { chinese: 'red', math: 'amber', english: 'blue', life: 'green' } as const

function dayTitle(day: string): string {
  const date = new Date(day + 'T00:00:00Z')
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日 · 周${WEEKDAYS[date.getUTCDay()]}`
}

function dayMood(day: string, today: string): { icon: string; line: string } {
  if (day === today) return { icon: '☀️', line: '今天的小事都在这儿，做完一朵花就开啦。' }
  if (day > today) return { icon: '🌱', line: '这一天还没到。想先做，也可以偷偷开始。' }
  return { icon: '🍃', line: '这一天已经过去啦。没做完的，现在补上也算数。' }
}

function taskMood(step: WorkStep, today: string): { label: string; color: 'gray' | 'green' | 'amber' | 'orange' | 'blue' } {
  if (step.skipped) return { label: '今天跳过', color: 'gray' }
  if (step.end && step.flowers) return { label: step.flowers.complete ? '整份做完' : '本次已收工', color: 'green' }
  if (step.end) return { label: '做完啦', color: 'green' }
  if (step.start) return { label: '正在做呀', color: 'amber' }
  if (!step.planned) return { label: '先放着', color: 'gray' }
  return step.planned < today ? { label: '可以补做', color: 'orange' } : { label: '等你开始', color: 'blue' }
}

function taskAction(step: WorkStep, day: string, today: string): string {
  if (step.end || step.skipped) return '看看记录'
  if (step.crown) return '戳破完成'
  if (step.flowers?.availableFrom && step.flowers.availableFrom > today) return '查看进度'
  if (step.start) return '接着做'
  if (!step.planned) return '选一天'
  if (day < today) return '补上它'
  if (day > today) return '先做做看'
  return '开始吧'
}

function cheer(done: number, total: number): string {
  if (!total) return '这一天还是空的，树叶在晒太阳。'
  if (done === 0) return '点开一项任务就能开始。'
  if (done === total) return '全部做完啦，给自己拍拍手！'
  return `已经做完 ${done} 件，还剩 ${total - done} 件。`
}

export default function DayTasksDialog({ tree, days, onClose, onSelect, onPop, onAdd, busy, message }: Props) {
  const homework = useHomeworkData()
  const [goal, setGoal] = useState('')
  const submission = useRef<{ day: string; name: string; id: string } | null>(null)
  async function addGoal(day: string) {
    const name = goal.trim()
    if (!name || busy) return
    if (submission.current?.name !== name || submission.current.day !== day)
      submission.current = { day, name, id: crypto.randomUUID() }
    if (await onAdd(day, name, submission.current.id)) {
      submission.current = null
      setGoal('')
    }
  }
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const templates = useMemo(() => new Map(homework.data.map((item) => [item.id, item])), [homework.data])
  async function retryContents() {
    setRefreshing(true)
    setRefreshError(false)
    try { await homework.refresh() }
    catch { setRefreshError(true) }
    finally { setRefreshing(false) }
  }
  const dates = [...days].sort()
  const single = dates.length === 1 ? dayMood(dates[0], tree.today) : null
  return (
    <AppDialog
      open
      icon={single?.icon ?? '🌳'}
      title={single ? dayTitle(dates[0]) : '以前留下的任务'}
      description={single?.line ?? '这些日子的事情还挂在树上。'}
      onOpenChange={(open) => { if (!open) onClose() }}
    >
      <Flex direction="column" gap="4">
        {dates.map((day) => {
          const steps = tree.steps.filter((step) => (step.planned ?? step.scheduled) === day && !isWeeklyPartialReceipt(step))
          const required = steps.filter((step) => !step.skipped)
          const completed = required.filter((step) => step.end)
          const doneMinutes = completed.reduce((sum, step) => sum + dayPlanMinutes(step), 0)
          const totalMinutes = required.reduce((sum, step) => sum + dayPlanMinutes(step), 0)
          const finished = required.length > 0 && completed.length === required.length
          const mood = dates.length > 1 ? dayMood(day, tree.today) : null
          return (
            <section key={day} aria-label={`${dayTitle(day)} 的任务`}>
              <Flex direction="column" gap="3">
                {mood && (
                  <Flex direction="column" gap="1">
                    <Text size="4" weight="bold">{mood.icon} {dayTitle(day)}</Text>
                    <Text size="2" color="gray">{mood.line}</Text>
                  </Flex>
                )}
                {single && day === tree.today && (
                  <form className="flex items-center gap-2" onSubmit={event => {
                    event.preventDefault()
                    void addGoal(day)
                  }}>
                    <TextField.Root
                      className="min-w-0 flex-1"
                      aria-label="今天的小目标"
                      placeholder="写下想完成的小目标（如：写数学作业）"
                      value={goal}
                      maxLength={120}
                      disabled={busy}
                      onChange={event => setGoal(event.target.value)}
                    >
                      <TextField.Slot aria-hidden="true"><LearningIcon name="crown" /></TextField.Slot>
                    </TextField.Root>
                    <Button type="submit" color="pink" disabled={busy || !goal.trim()}>添加</Button>
                  </form>
                )}
                {message && single && <Text size="2" color="red" role="alert">{message}</Text>}
                {steps.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <StatTile
                        size="sm"
                        tone={finished ? 'success' : 'accent'}
                        label="🌟 做完了"
                        value={`${completed.length}/${required.length}`}
                        unit="件"
                      />
                      <StatTile
                        size="sm"
                        tone="info"
                        label="计划用时"
                        value={`${doneMinutes}/${totalMinutes}`}
                        unit="分钟"
                        hint="已完成任务 / 全部任务"
                      />
                    </div>
                    <Text size="2">{cheer(completed.length, required.length)}</Text>
                  </>
                ) : (
                  <StickerCard tone="info" size="sm" elevation="flat" radius="md">
                    <Text size="3" weight="bold">这一天还是空的，树叶在晒太阳。</Text>
                  </StickerCard>
                )}
                {steps.map((step) => {
                  const subject = bubbleSubject(step)
                  const done = !!step.end || !!step.skipped
                  const expanded = expandedId === step.id
                  const content = expanded ? previewPractice(tree, step, templates.get(step.occurrence.split('/')[0])) : null
                  const needsTemplate = expanded && !done && step.practice === undefined && !tree.steps.some((peer) => peer.occurrence === step.occurrence && peer.practice !== undefined)
                  const contentLoading = needsTemplate && (homework.isLoading || refreshing)
                  const contentError = needsTemplate && (!!homework.error || refreshError)
                  const questions = flowerQuestionProgress(step)
                  const badge = taskMood(step, tree.today)
                  const action = taskAction(step, day, tree.today)
                  return (
                    <StickerCard key={step.id} tone={step.skipped ? 'paper' : done ? 'success' : step.start ? 'warning' : 'info'} size="none" elevation="sm" radius="md">
                      <Button
                        type="button"
                        variant="ghost"
                        color="gray"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : step.id)}
                        style={{
                          boxSizing: 'border-box', width: '100%', height: 'auto', minHeight: 48,
                          margin: 0, padding: '8px 12px', borderRadius: 'inherit', outlineOffset: -3,
                          textAlign: 'left', whiteSpace: 'normal',
                        }}
                      >
                        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full ${step.crown ? 'bg-pink-100' : CHIP[step.subject]}`}>
                          {step.crown ? <LearningIcon name="crown" /> : <LearningIcon name={SUBJECT_ICON[step.subject]} />}
                        </span>
                        <span className="min-w-0 flex-1 break-words font-bold">{step.name}</span>
                        <Text size="2" color="gray" className="shrink-0">
                          {step.subject === 'life' ? '不计时' : `${weeklyHomeworkStart(step) ? '周目标 ' : ''}${step.minutes} 分钟`}
                        </Text>
                        <Badge variant="soft" radius="full" color={badge.color} className="shrink-0">{badge.label}</Badge>
                        <ChevronDown aria-hidden="true" size={16} className={`shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                      </Button>
                      {expanded && <Flex direction="column" gap="3" className="px-3 pb-3">
                        <Text size="2" color="gray">{subject.label}{step.flowers && ` · 🌸 ${step.flowers.collected} 朵`}{questions && ` · ${questions.done}/${questions.total}`}</Text>
                        {step.end && <Text size="2" color="gray">完成于 {dayOf(step.end)} · {timing(step)}</Text>}
                        <TaskLearningContent step={step} content={content} loading={contentLoading} error={contentError} />
                        {contentError && <Button variant="soft" loading={refreshing} onClick={() => void retryContents()}>再翻开一次</Button>}
                        <Button
                          size="3"
                          className="w-full"
                          color={done ? 'gray' : step.crown ? 'pink' : ACTION_COLOR[step.subject]}
                          variant={done ? 'soft' : 'solid'}
                          disabled={busy}
                          onClick={() => step.crown && !done ? onPop(step.id) : onSelect(step.id)}
                          aria-label={`${action}：${step.name}`}
                        >
                          {action}
                        </Button>
                      </Flex>}
                    </StickerCard>
                  )
                })}
              </Flex>
            </section>
          )
        })}
      </Flex>
    </AppDialog>
  )
}
