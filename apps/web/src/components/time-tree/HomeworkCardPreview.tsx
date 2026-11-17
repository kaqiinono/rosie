'use client'

import type { Homework } from '@rosie/tasks'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { previewHomeworkPractice, previewPractice } from '@/lib/time-tree/practicePreview'
import HomeworkContentPanel from './HomeworkContentPanel'
import { useTimeTree } from './useTimeTree'
import { hasWeeklyPlanPractice } from './weeklyPlanPractice'

export default function HomeworkCardPreview({ homework, onClose }: {
  homework: Homework
  onClose: () => void
}) {
  const api = useTimeTree()
  const tree = api.tree
  const step = tree?.steps
    .filter(item => item.occurrence.split('/')[0] === homework.id && !item.end && !item.skipped)
    .sort((a, b) => a.scheduled.localeCompare(b.scheduled) || a.id.localeCompare(b.id))[0]
  const content = homework.subject !== 'life' && tree
    ? step
      ? previewPractice(tree, step, homework)
      : previewHomeworkPractice(tree, homework.practice_binding, tree.today)
    : null
  const hasPractice = homework.subject !== 'life' && !!homework.practice_binding
  const notes = step?.notes || homework.notes

  return (
    <AppDialog open title={homework.name} presentation={hasWeeklyPlanPractice(content) ? 'bottom-drawer' : 'dialog'} onOpenChange={open => { if (!open) onClose() }}>
      <Flex direction="column" gap="3">
        {hasPractice && (
          <HomeworkContentPanel
            name={content?.name}
            row={content?.row}
            href={content?.href}
            items={content?.items}
            exhausted={content?.exhausted}
            loading={api.isLoading}
            error={api.error ? api.message : undefined}
            onRetry={() => void api.run({ kind: 'sync' })}
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
