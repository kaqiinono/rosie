'use client'

import type { Homework } from '@rosie/tasks'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import type { previewHomeworkCard } from '@/lib/time-tree/practicePreview'
import HomeworkContentPanel from './HomeworkContentPanel'
import { hasWeeklyPlanPractice } from './weeklyPlanPractice'

export default function HomeworkCardPreview({ homework, current, wordGroups, loading, error, onRetry, onClose }: {
  homework: Homework
  current: ReturnType<typeof previewHomeworkCard>
  wordGroups?: { scope: string; words: string[] }[]
  loading: boolean
  error?: string
  onRetry: () => void
  onClose: () => void
}) {
  const content = current?.content
  const step = current?.step
  const hasPractice = homework.subject !== 'life' && !!homework.practice_binding
  const notes = step?.notes || homework.notes

  return (
    <AppDialog open title={homework.name} presentation={hasWeeklyPlanPractice(content) ? 'bottom-drawer' : 'dialog'} onOpenChange={open => { if (!open) onClose() }}>
      <Flex direction="column" gap="3">
        {wordGroups?.filter(group => group.words.length).map(({ scope, words }) =>
          <Flex key={scope} direction="column" gap="1" minWidth="0">
            <Text as="p" size="2" weight="bold">{scope || '单词'}</Text>
            <Text as="p" size="2" className="wrap-anywhere">{words.join('、')}</Text>
          </Flex>)}
        {hasPractice && !current && !loading && !error && <Text size="2">本期暂无排期。</Text>}
        {hasPractice && current && !content && !loading && !error && <Text size="2">
          {current.blocked ? '等待上次作业完成。' : '暂无练习内容。'}
        </Text>}
        {hasPractice && (content || loading || error) && (
          <HomeworkContentPanel
            name={content?.name}
            row={content?.row}
            href={content?.href}
            items={content?.items}
            exhausted={content?.exhausted}
            loading={loading}
            error={error}
            scheduledDate={current?.date}
            onRetry={onRetry}
          />
        )}
        {notes && <Text className="whitespace-pre-wrap break-words">{notes}</Text>}
        {step?.planNote && <Text className="whitespace-pre-wrap break-words">{step.planNote}</Text>}
        {!hasPractice && !notes && !step?.planNote && (
          <Text size="2" color="gray">这项任务暂无补充说明。</Text>
        )}
        <Button variant="soft" onClick={onClose}>收起预览</Button>
      </Flex>
    </AppDialog>
  )
}
