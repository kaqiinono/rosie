'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Button, Flex, Select, Text } from '@rosie/ui/themes'
import { bindEntry, type PracticeBinding } from '../../practiceEntries'
import type { HomeworkSubject } from '../../homework'
import { usePracticeEntries } from '../../usePracticeEntries'
import PracticeStartPicker from './PracticeStartPicker'

type Props = { subject: HomeworkSubject; value: PracticeBinding | null; onChange: (value: PracticeBinding | null) => void }
export default function PracticeEntryPicker({ subject, value, onChange }: Props) {
  const { data, isLoading, error, refresh } = usePracticeEntries()
  const [message, setMessage] = useState('')
  const entries = data.filter((item) => item.subject === subject)
  const storedEntry = data.find((item) => item.id === value?.entryId)
  const mismatched = !!storedEntry && storedEntry.subject !== subject
  const entry = entries.find((item) => item.id === value?.entryId)
  function choose(id: string) {
    setMessage('')
    if (id === 'none') { onChange(null); return }
    if (id === value?.entryId) return
    const selected = entries.find((item) => item.id === id)
    if (!selected) return
    try { onChange({ ...bindEntry(selected, selected.rows[0]?.id ?? null), startId: null, progression: value?.progression }) }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : '入口无效') }
  }
  return <Flex direction="column" gap="2">
    <Text weight="bold" size="2">练习入口</Text>
    {isLoading ? <Text role="status">正在读取入口…</Text> : error ? <Button type="button" variant="soft" onClick={() => void refresh()}>读取失败，重试</Button> :
      <Select.Root value={mismatched ? 'none' : value?.entryId ?? 'none'} onValueChange={choose}>
        <Select.Trigger aria-label="练习入口" />
        <Select.Content>
          <Select.Item value="none">不设置入口</Select.Item>
          {value && !storedEntry && <Select.Item value={value.entryId}>{value.name}（已删除，使用已保存内容）</Select.Item>}
          {entries.map((item) => <Select.Item key={item.id} value={item.id}>{item.name}</Select.Item>)}
        </Select.Content>
      </Select.Root>}
    {mismatched && <Flex direction="column" gap="1"><Text size="2" color="red">原入口不属于当前科目，请重新选择。</Text><Button type="button" variant="soft" onClick={() => onChange(null)}>移除原入口</Button></Flex>}
    {!mismatched && !!value?.rows.length && <PracticeStartPicker key={value.key} value={value} onChange={onChange} />}
    {entry && value && <Button type="button" size="1" variant="soft" onClick={() => {
      try { onChange({ ...bindEntry(entry, entry.rows.some((r) => r.id === value.startId) ? value.startId : entry.rows[0]?.id ?? null), progression: value.progression }); setMessage('已同步入口内容，将从所选开始项重新递进；保存作业后生效。') }
      catch (cause) { setMessage(cause instanceof Error ? cause.message : '同步失败') }
    }}>同步入口内容并重设起点</Button>}
    {message && <Text size="2" role="status">{message}</Text>}
    <Button type="button" variant="ghost" asChild><Link href={`/setting/task-entries?subject=${subject}`}>管理练习入口</Link></Button>
  </Flex>
}
