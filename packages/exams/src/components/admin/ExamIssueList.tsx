'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { StickerCard } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import type { ExamDraftInput, ValidationIssue } from '../../validation/contracts'
import { examIssueTasks, type ExamIssueTask, type IssueAction } from './examIssueTasks'

type Props = {
  issues: readonly ValidationIssue[]
  draft: ExamDraftInput | null
  revisionId: string
  navigationDisabled: boolean
  onOpen: (action: 'content' | 'words' | 'raw' | 'review') => void
}
const ACTION_LABELS: Record<IssueAction, string> = {
  content: '打开题面与解答', words: '打开词条关联', raw: '打开内容包',
  images: '前往图片任务', media: '管理媒体资源', review: '前往审核区',
}

function IssueTask({ task, ...props }: Omit<Props, 'issues'> & { task: ExamIssueTask }) {
  const [details, setDetails] = useState(false)
  const detailsId = useId()
  const external = task.action === 'images' || task.action === 'media'
  const href = task.action === 'images' ? `/admin/exams/images?revisionId=${encodeURIComponent(props.revisionId)}`
    : `/admin/sync?panel=exams&revisionId=${encodeURIComponent(props.revisionId)}`
  return <StickerCard as="li" tone="paper" elevation="flat" size="sm">
    <Flex direction="column" gap="2">
      <Text as="p" size="2" weight="bold">{task.location}</Text>
      <Text as="p" size="2">{task.message}</Text>
      {task.reason && /[\u3400-\u9fff]/.test(task.reason) && <Text as="p" size="2">阻断说明：{task.reason}</Text>}
      <Flex gap="2" wrap="wrap">
        {external && (props.navigationDisabled
          ? <Button size="2" variant="soft" disabled>{ACTION_LABELS[task.action]}</Button>
          : <Button size="2" variant="soft" asChild><Link href={href}>{ACTION_LABELS[task.action]}</Link></Button>)}
        {!external && props.draft && <Button size="2" variant="soft" onClick={() => {
          if (task.action !== 'images' && task.action !== 'media') props.onOpen(task.action)
        }}>{ACTION_LABELS[task.action]}</Button>}
        <Button size="2" variant="ghost" color="gray" aria-expanded={details} aria-controls={detailsId} onClick={() => setDetails(value => !value)}>
          {details ? '收起技术详情' : '技术详情'}
        </Button>
      </Flex>
      {external && props.navigationDisabled && <Text as="p" size="1" color="gray">请先保存修改并等待当前操作结束，再离开编辑页。</Text>}
      {details && <div id={detailsId} className="min-w-0 break-words">
        {task.reason && <Text as="p" size="1" color="gray">原始阻断说明：{task.reason}</Text>}
        {task.issues.map((issue, index) => <Text as="p" size="1" color="gray" key={index}>{issue.path} · {issue.code} — {issue.message}</Text>)}
      </div>}
    </Flex>
  </StickerCard>
}

export function ExamIssueList(props: Props) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const tasks = examIssueTasks(props.issues, props.draft)
  if (!tasks.length) return <Text as="p" size="2" color="gray">当前未列出待办；是否可发布仍以完整审核结果为准。</Text>
  return <Flex direction="column" gap="3">
    <Text as="p" size="2" color="gray">当前列出 {tasks.length} 项待办{props.issues.length > tasks.length ? '（重复提示已合并）' : ''}。处理后请保存并重新读取。</Text>
    <ul id={listId} className="m-0 grid list-none gap-3 p-0">
      {(expanded ? tasks : tasks.slice(0, 6)).map(task => <IssueTask key={task.key} {...props} task={task} />)}
    </ul>
    {tasks.length > 6 && <Flex><Button size="2" variant="soft" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>
      {expanded ? '收起待办' : `展开其余 ${tasks.length - 6} 项`}
    </Button></Flex>}
  </Flex>
}
