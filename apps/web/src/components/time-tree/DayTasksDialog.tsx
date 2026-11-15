'use client'

import { useMemo, useState } from 'react'
import { useHomeworkData } from '@rosie/tasks'
import { AppDialog, StatTile, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { SUBJECTS, type SubjectKey } from '@/components/tree-demo/garden/model'
import { dayOf, timing, type TreeData, type WorkStep } from '@/lib/time-tree/types'
import { previewPractice } from '@/lib/time-tree/practicePreview'
import TaskLearningContent from './TaskLearningContent'

type Props = {
  tree: TreeData
  days: string[]
  busy: boolean
  onClose: () => void
  onSelect: (id: string) => void
}

const WEEKDAYS = '日一二三四五六'
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
  if (step.end) return { label: '做完啦', color: 'green' }
  if (step.start) return { label: '正在做呀', color: 'amber' }
  if (!step.planned) return { label: '先放着', color: 'gray' }
  return step.planned < today ? { label: '可以补做', color: 'orange' } : { label: '等你开始', color: 'blue' }
}

function taskAction(step: WorkStep, day: string, today: string): string {
  if (step.end || step.skipped) return '看看记录'
  if (step.start) return '接着做'
  if (!step.planned) return '选一天'
  if (day < today) return '补上它'
  if (day > today) return '先做做看'
  return '开始吧'
}

function cheer(done: number, total: number): string {
  if (!total) return '这一天还是空的，树叶在晒太阳。'
  if (done === 0) return '还没开始，点下面的按钮就能做。'
  if (done === total) return '全部做完啦，给自己拍拍手！'
  return `已经做完 ${done} 件，还剩 ${total - done} 件。`
}

export default function DayTasksDialog({ tree, days, busy, onClose, onSelect }: Props) {
  const homework = useHomeworkData()
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
          const steps = tree.steps.filter((step) => (step.planned ?? step.scheduled) === day)
          const required = steps.filter((step) => !step.skipped)
          const completed = required.filter((step) => step.end)
          const doneMinutes = completed.reduce((sum, step) => sum + step.minutes, 0)
          const totalMinutes = required.reduce((sum, step) => sum + step.minutes, 0)
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
                        label="⏱️ 大约"
                        value={finished ? doneMinutes : totalMinutes}
                        unit="分钟"
                        hint={finished ? '已经花掉的时间' : '全部做完大概这么久'}
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
                  const subject = SUBJECTS[step.subject]
                  const done = !!step.end || !!step.skipped
                  const content = previewPractice(tree, step, templates.get(step.occurrence.split('/')[0]))
                  const needsTemplate = !done && step.practice === undefined && !tree.steps.some((peer) => peer.occurrence === step.occurrence && peer.practice !== undefined)
                  const contentLoading = needsTemplate && (homework.isLoading || refreshing)
                  const contentError = needsTemplate && (!!homework.error || refreshError)
                  const badge = taskMood(step, tree.today)
                  const action = taskAction(step, day, tree.today)
                  return (
                    <StickerCard key={step.id} tone="paper" size="md" elevation="sm" radius="lg">
                      <Flex direction="column" gap="3">
                        <Flex gap="3" align="center">
                          <span aria-hidden="true" className={`flex size-12 shrink-0 items-center justify-center rounded-full text-2xl ${CHIP[step.subject]}`}>
                            {subject.emoji}
                          </span>
                          <Flex direction="column" gap="1" className="min-w-0 flex-1">
                            <Flex gap="2" align="start" justify="between">
                              <Text size="4" weight="bold" className="min-w-0 break-words">{step.name}</Text>
                              <Badge variant="soft" radius="full" color={badge.color}>{badge.label}</Badge>
                            </Flex>
                            <Text size="2" color="gray">{subject.label} · 大约 {step.minutes} 分钟</Text>
                          </Flex>
                        </Flex>
                        {step.end && <Text size="2" color="gray">完成于 {dayOf(step.end)} · {timing(step)}</Text>}
                        <TaskLearningContent step={step} content={content} loading={contentLoading} error={contentError} />
                        {contentError && <Button variant="soft" loading={refreshing} onClick={() => void retryContents()}>再翻开一次</Button>}
                        <Button
                          size="3"
                          className="w-full"
                          color={done ? 'gray' : ACTION_COLOR[step.subject]}
                          variant={done ? 'soft' : 'solid'}
                          disabled={busy}
                          onClick={() => onSelect(step.id)}
                          aria-label={`${action}：${step.name}`}
                        >
                          {action}
                        </Button>
                      </Flex>
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
