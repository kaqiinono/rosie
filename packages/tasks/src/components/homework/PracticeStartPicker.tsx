'use client'

import { useMemo, useRef, useState } from 'react'
import { FormSelect } from '@rosie/ui'
import { Flex, Switch, Text, TextField } from '@rosie/ui/themes'
import { practiceSelectionPath, type PracticeBinding, type PracticeEntryRow } from '../../practiceEntries'
import { defaultPracticeProgression } from '../../practiceProgression'
import { localDate } from '../../time'
import { HOMEWORK_WEEKDAYS, HOMEWORK_WEEKDAY_ORDER } from '../../homework'

function leafLevel(row: PracticeEntryRow): string {
  if (row.values.sentenceId) return '句子'
  if (row.values.problemId) return '题目'
  if (row.values.unitId) return '单元'
  if (row.values.poemId) return '古诗'
  if (row.values.lesson || row.values.lessonKey) return '课程'
  return '开始项'
}

type Props = { value: PracticeBinding; onChange: (value: PracticeBinding) => void; purpose?: 'start' | 'content' }

export default function PracticeStartPicker({ value, onChange, purpose = 'start' }: Props) {
  const progression = value.progression ?? defaultPracticeProgression(localDate())
  const rows = useMemo(() => value.rows.map((row) => ({
    row,
    path: [...practiceSelectionPath(row).map((node) => ({ ...node, id: `group:${node.level}:${node.id}` })),
      { id: `row:${row.id}`, label: row.label, level: purpose === 'content' && leafLevel(row) === '开始项' ? '内容' : leafLevel(row) }],
  })), [value.rows, purpose])
  const originalStart = useRef(value.startId)
  const [selected, setSelected] = useState<string[]>(() => rows.find(({ row }) => row.id === value.startId)?.path.map((node) => node.id) ?? [])
  const [query, setQuery] = useState('')
  const fallback = rows.every(({ path }) => path.length === 1)
  const visible = fallback && query.trim() ? rows.filter(({ row }) => row.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : rows
  const controls = []
  let candidates = visible
  for (let depth = 0; candidates.length; depth++) {
    const nodes = [...new Map(candidates.flatMap(({ path }) => path[depth] ? [[path[depth].id, path[depth]] as const] : [])).values()]
    nodes.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true }))
    if (!nodes.length) break
    const level = [...new Set(nodes.map((node) => node.level))].join(' / ')
    const index = depth
    controls.push(<Flex key={depth} direction="column" gap="1">
      <Flex align="center" justify="between" gap="2" wrap="wrap">
        <Text size="2">{level}</Text>
        {purpose === 'start' && nodes.every((node) => node.id.startsWith('row:')) && (
          <Flex asChild align="center" gap="2">
            <label><Switch aria-label="自动推进课程" checked={progression.enabled}
              onCheckedChange={(enabled) => onChange({ ...value, progression: { ...progression, enabled } })} />
              <Text size="2">自动推进</Text></label>
          </Flex>
        )}
      </Flex>
      <FormSelect ariaLabel={level} value={selected[depth] ?? ''} options={[{ value: '', label: `请选择${level}` }, ...nodes.map((node) => ({ value: node.id, label: node.label }))]}
        onValueChange={(id) => {
          const next = id ? [...selected.slice(0, index), id] : selected.slice(0, index)
          setSelected(next)
          const leaf = rows.find(({ path }) => path.length === next.length && path.every((node, i) => node.id === next[i]))
          const startId = leaf?.row.id ?? null
          onChange({ ...value, startId, key: startId && startId !== originalStart.current ? crypto.randomUUID() : value.key })
        }} />
    </Flex>)
    if (!selected[depth]) break
    candidates = candidates.filter(({ path }) => path[depth]?.id === selected[depth] && path.length > depth + 1)
  }
  return <Flex direction="column" gap="2">
    <Text size="2" weight="bold">{purpose === 'content' ? '选择具体内容' : '开始位置'}</Text>
    {fallback && <TextField.Root aria-label={purpose === 'content' ? '搜索内容' : '搜索开始项'} placeholder="搜索内容名称" value={query} onChange={(e) => setQuery(e.target.value)} />}
    {controls}
    {purpose === 'start' && progression.enabled && (
      <Flex direction="column" gap="3">
        <Flex gap="3" align="end">
        <Flex direction="column" gap="1" flexGrow="1" minWidth="0">
          <Text size="2">推进方式</Text>
          <FormSelect ariaLabel="课程推进方式" value={progression.mode}
            options={[{ value: 'daily', label: '按日推进' }, { value: 'weekly', label: '按周推进' }]}
            onValueChange={(mode) => onChange({ ...value, progression: { ...progression, mode: mode as 'daily' | 'weekly' } })} />
        </Flex>
        <Flex direction="column" gap="1" width="6rem" flexShrink="0">
          <Text as="label" size="2" htmlFor="practice-advance-amount">推进数量</Text>
          <TextField.Root id="practice-advance-amount" aria-label="推进数量" type="number" min="1" step="1"
            value={progression.amount === 0 ? '' : progression.amount ?? 1}
            onChange={(event) => onChange({ ...value, progression: {
              ...progression, amount: event.target.value === '' ? 0 : Number(event.target.value),
            } })} />
        </Flex>
        </Flex>
        {progression.mode === 'weekly' && <Flex direction="column" gap="1" flexGrow="1" minWidth="0">
          <Text size="2">推进星期</Text>
          <FormSelect ariaLabel="推进星期" value={String(progression.weekday)}
            options={HOMEWORK_WEEKDAY_ORDER.map((day) => ({ value: String(day), label: HOMEWORK_WEEKDAYS[day] }))}
            onValueChange={(weekday) => onChange({ ...value, progression: { ...progression, weekday: Number(weekday) } })} />
        </Flex>}
      </Flex>
    )}
    {!visible.length && <Text size="2">没有匹配的内容</Text>}
    {!value.startId && <Text size="2" color="gray">{purpose === 'content' ? '选择具体内容后，下方直接展示。' : '请选择到具体开始项后保存。'}</Text>}
    {purpose === 'start' && <Text size="1" color="gray">{!progression.enabled
      ? '关闭自动推进后，新生成的作业固定使用从所选起点开始的同一组内容。'
      : progression.mode === 'daily'
        ? `每次作业包含连续 ${progression.amount || 1} 项，每天切换到下一组；不含周末时，周六、周日不推进。`
        : `每次作业包含连续 ${progression.amount || 1} 项，每到${HOMEWORK_WEEKDAYS[progression.weekday]}切换到下一组，其余日期使用同一组。`} 已生成的作业保留原内容；新设置保存后生效。</Text>}
  </Flex>
}
