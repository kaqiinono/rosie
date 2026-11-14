'use client'

import { useMemo, useRef, useState } from 'react'
import { FormSelect } from '@rosie/ui'
import { Flex, Text, TextField } from '@rosie/ui/themes'
import { practiceSelectionPath, type PracticeBinding, type PracticeEntryRow } from '../../practiceEntries'

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
    nodes.sort((a, b) => b.label.localeCompare(a.label, 'zh-CN', { numeric: true }))
    if (!nodes.length) break
    const level = [...new Set(nodes.map((node) => node.level))].join(' / ')
    const index = depth
    controls.push(<Flex key={depth} direction="column" gap="1">
      <Text size="2">{level}</Text>
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
    {!visible.length && <Text size="2">没有匹配的内容</Text>}
    {!value.startId && <Text size="2" color="gray">{purpose === 'content' ? '选择具体内容后，下方直接展示。' : '请选择到具体开始项后保存。'}</Text>}
    {purpose === 'start' && <Text size="1" color="gray">这里只设置起始位置；后续仍按入口完整列表顺序递进，不限于所选教材、单元或课程。</Text>}
  </Flex>
}
