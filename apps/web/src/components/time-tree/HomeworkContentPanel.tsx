'use client'

import dynamic from 'next/dynamic'
import { useId, useState, type ReactNode } from 'react'
import { findPassage, findPassageByKey } from '@rosie/english/utils/reading-data'
import { entryHref, type PracticeEntryRow } from '@rosie/tasks'
import { ArrowIcon, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Text } from '@rosie/ui/themes'
import type { TreeAction } from '@/lib/time-tree/types'
import PracticeResources from './PracticeResources'
import { useHomeworkPracticeNavigation } from './TimeTreeLauncher'
import { hasWeeklyPlanPractice, weeklyPlanPracticeTarget } from './weeklyPlanPractice'

const MathPracticeContent = dynamic(() => import('./MathPracticeContent'), { loading: () => <Flex direction="column" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })
const EmbeddedCalcStartPanel = dynamic(() => import('@rosie/calc/components/EmbeddedCalcStartPanel'), { loading: () => <Flex direction="column" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })
const HomeworkWeeklyPlanPractice = dynamic(() => import('./HomeworkWeeklyPlanPractice'), { loading: () => <Flex position="relative" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })

type Props = {
  name?: string
  row?: PracticeEntryRow | null
  href?: string | null
  items?: { row: PracticeEntryRow; href: string }[]
  exhausted?: boolean
  loading?: boolean
  error?: string
  disabled?: boolean
  onCorrect?: (problemId: string) => Promise<void>
  completedRows?: string[]
  addedRows?: string[]
  canAppend?: boolean
  compact?: boolean
  activeHomeworkId?: string
  onEdit?: (edit: NonNullable<TreeAction['questionEdit']>, rowId?: string) => Promise<void>
  onRetry?: () => void
}

/** Render each frozen item with its own content and destination. */
function PracticeItemCard({ row, href, disabled, onCorrect, title, expanded, toggle, controls, compact, name, activeHomeworkId }: Pick<Props, 'row' | 'href' | 'disabled' | 'onCorrect' | 'compact' | 'name' | 'activeHomeworkId'> & {
  title: string
  controls?: ReactNode
  expanded: boolean
  toggle: () => void
}) {
  const openPractice = useHomeworkPracticeNavigation(activeHomeworkId)
  const detailId = useId()
  const [opened, setOpened] = useState(false)
  const calc = Boolean(href && /^\/calc(?:[/?#]|$)/.test(href))
  const adaptive = Boolean(href && /^\/english\/words\/adaptive\/[^/?#]+\/practice\/?(?:[?#]|$)/.test(href))
  const math = Boolean(row?.values.problemId && (row.values.contentType === 'math-question' || href?.startsWith('/math/')))
  const lessonPassage = row && !row.values.key && row.values.stage && row.values.unit && row.values.lesson
    ? findPassage(row.values.stage, row.values.unit, row.values.lesson)
    : undefined
  const reading = Boolean(lessonPassage || row?.values.sentenceId || (row?.values.key && findPassageByKey(row.values.key)))
  if (calc) return <EmbeddedCalcStartPanel disabled={disabled} />
  const detailButton = href && !calc && !reading ? <Button variant="soft" disabled={disabled} onClick={() => openPractice(entryHref(href, {}))}>进入详情页</Button> : null
  return <StickerCard size="none" tone={compact ? 'paper' : 'white'} elevation="flat" radius="md" className="min-w-0">
    <Button type="button" variant="ghost" color="gray" aria-expanded={expanded} aria-controls={detailId}
      style={{ boxSizing: 'border-box', width: '100%', height: 'auto', minHeight: 44, margin: 0, padding: 12, borderRadius: 'inherit', outlineOffset: -2, justifyContent: 'space-between', whiteSpace: 'normal', textAlign: 'left' }}
      onClick={() => { setOpened(true); toggle() }}>
      <span className="block min-w-0 break-words">
        {name && <Text size="4" weight="bold" className="block">{name}</Text>}
        <Text size={compact ? '3' : '2'} color={name ? 'gray' : undefined} weight="bold">{title}</Text>
      </span>
      <span aria-hidden="true" className="shrink-0">
        <ArrowIcon size={18} className={expanded ? '-rotate-90' : 'rotate-90'} />
      </span>
    </Button>
    <div id={detailId} hidden={!expanded} inert={disabled || undefined} className="px-3 pb-3">
      {math && row && opened ? <MathPracticeContent onCorrect={onCorrect} row={row} actions={detailButton} expanded={expanded} /> : expanded && (
        <Flex direction="column" gap="3">
          {row && <PracticeResources row={row} detailPassage={lessonPassage} actions={detailButton} activeHomeworkId={activeHomeworkId} />}
          {adaptive && <Text size="2">打开后直接进入这次自适应练习。</Text>}
          {!row && detailButton && <Flex gap="2" wrap="wrap" align="center">{detailButton}</Flex>}
        </Flex>
      )}
      {controls}
    </div>
  </StickerCard>
}

/** Preview callers omit the editing callbacks. */
export default function HomeworkContentPanel({ name, row, href, items, exhausted = false, loading = false, error, disabled = false, completedRows, addedRows, canAppend, compact = false, activeHomeworkId, onEdit, onCorrect, onRetry }: Props) {
  const entries = items?.length ? items : [{ row, href }]
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const weeklyPlan = hasWeeklyPlanPractice({ items: entries })
  const compactItem = compact && !loading && !error && !exhausted && !weeklyPlan && !completedRows &&
    entries.length === 1 && !!(entries[0].row || entries[0].href)
  return <section aria-label="作业内容" className="w-full min-w-0">
    <StickerCard tone="paper" variant={compactItem ? 'soft' : 'outlined'} size={compactItem ? 'none' : 'sm'}
      elevation="flat" radius="md" className="w-full">
      <Flex direction="column" gap="3">
        {!compactItem && <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Heading as="h3" size="3">作业内容</Heading>
          {completedRows && <Text size="2" weight="bold" color="green">
            已完成 {entries.filter(item => item.row && completedRows.includes(item.row.id)).length} / {entries.filter(item => item.row?.values.problemId).length} 题
          </Text>}
        </Flex>}
        {loading ? <Flex position="relative" minHeight="160px"><LoadingOverlay visible placement="content" /></Flex> : error ? <Flex direction="column" gap="2">
          <Text role="alert" color="red">{error}</Text>
          {onRetry && <Button variant="soft" disabled={disabled} onClick={onRetry}>重试读取内容</Button>}
        </Flex> : <>
          {name && !compactItem && <Text size="2">{name}{!completedRows && entries.length > 1 ? ` · 共 ${entries.length} 项` : ''}</Text>}
          {!exhausted && weeklyPlan && <HomeworkWeeklyPlanPractice items={entries} disabled={disabled} />}
          {exhausted ? <Text size="2">全部练习内容已完成，可以继续线下完成作业，或在作业设置中选择新的开始项。</Text> : entries.map((item, index) => {
            if (weeklyPlanPracticeTarget(item)) return null
            if (!item.row && !item.href) return null
            const key = item.row?.id ?? item.href!
            const label = item.row?.label || name || '练习内容'
            const rowId = item.row?.id
            const done = !!rowId && completedRows?.includes(rowId)
            const ordinal = entries.length > 1 ? `第 ${index + 1} 项 · ` : ''
            const controls = onEdit && rowId && item.row?.values.problemId && (
              <Flex gap="2" wrap="wrap" mt="3">
                <Button variant="soft" color="green" aria-pressed={!!done} disabled={disabled}
                  onClick={() => void onEdit(done ? 'undo' : 'complete', rowId)}>
                  {done ? '已完成，撤销标记' : '纸上已完成'}
                </Button>
                {!done && addedRows?.includes(rowId) && <Button variant="soft" color="red" disabled={disabled}
                  onClick={() => void onEdit('remove', rowId)}>删除加题</Button>}
              </Flex>
            )
            return <PracticeItemCard controls={controls}
              onCorrect={onEdit && rowId ? async () => { if (!done) await onEdit('complete', rowId) } : onCorrect} key={key} {...item} disabled={disabled}
              compact={compactItem} name={compactItem && name !== label ? name : undefined} activeHomeworkId={activeHomeworkId}
              title={`${done ? '✓ ' : ''}${ordinal}${label}`}
              expanded={expandedKey === key}
              toggle={() => setExpandedKey(current => current === key ? null : key)} />
          })}
          {onEdit && canAppend && <Button variant="soft" disabled={disabled} onClick={() => void onEdit('append')}>再来一题</Button>}
        </>}
      </Flex>
    </StickerCard>
  </section>
}
