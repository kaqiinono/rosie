'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { entryHref, entryVariables, PracticeStartPicker, usePracticeEntries, type PracticeBinding, type PracticeEntry } from '@rosie/tasks'
import { FormSelect, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import HomeworkContentPanel from '../time-tree/HomeworkContentPanel'

const SUBJECTS = [
  { value: 'math', label: '数学（含口算）' },
  { value: 'chinese', label: '语文' },
  { value: 'english', label: '英语' },
  { value: 'life', label: '生活 / 其他' },
] as const

type EntryApi = ReturnType<typeof usePracticeEntries>

function RealContentPreview({ api }: { api: EntryApi }) {
  const [subject, setSubject] = useState('')
  const [entryId, setEntryId] = useState('')
  const [startId, setStartId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const entries = api.data.filter(item => item.subject === subject).sort((a, b) => b.name.localeCompare(a.name, 'zh-CN', { numeric: true }))
  const entry = entries.find(item => item.id === entryId)
  const parameterized = !!entry && entryVariables(entry.path).length > 0
  const selectedRow = parameterized ? entry?.rows.find(row => row.id === startId) : undefined
  const binding = useMemo<PracticeBinding | null>(() => entry ? {
    key: `preview:${entry.id}`,
    entryId: entry.id,
    name: entry.name,
    path: entry.path,
    rows: entry.rows,
    startId,
  } : null, [entry, startId])
  const selectionReady = !!entry && (!parameterized || !!selectedRow)
  let href: string | null = null
  let contentError: string | undefined
  if (selectionReady && entry) {
    try { href = entryHref(entry.path, selectedRow?.values ?? {}) }
    catch (cause) { contentError = cause instanceof Error ? cause.message : '此内容的详情地址无效，请在作业内容管理中修正。' }
  }
  async function refresh() {
    setRefreshing(true); setRefreshError('')
    try { await api.refresh() }
    catch { setRefreshError('读取失败，请重试。') }
    finally { setRefreshing(false) }
  }
  function selectEntry(id: string) {
    setEntryId(id); setStartId(null)
  }
  return <PageShell fillContent title="作业内容预览" subtitle="按科目选择真实内容，查看生命树中的内容面板。" tone="paper" width="default" actions={<Button asChild variant="soft"><Link href={subject ? `/setting/task-entries?subject=${subject}` : '/setting/task-entries'}>作业内容管理</Link></Button>}>
    <Flex direction="column" gap="4" flexGrow="1">
      {!api.user ? <Text>请先登录后选择内容。</Text> : api.isLoading && !api.data.length ? (
        <div className="relative flex flex-1 flex-col"><LoadingOverlay visible placement="content" /></div>
      ) : <>
        {(api.error || refreshError) && <StickerCard tone="danger" size="sm"><Flex direction="column" gap="2"><Text role="alert">{refreshError || '读取失败，请重试。'}</Text><Button loading={refreshing} onClick={() => void refresh()}>重新读取</Button></Flex></StickerCard>}
        <StickerCard size="md" elevation="flat">
          <Flex direction="column" gap="4">
            <Flex justify="between" align="center" gap="3"><Text weight="bold">选择内容</Text><Button variant="ghost" size="1" loading={refreshing} onClick={() => void refresh()}>刷新内容列表</Button></Flex>
            <Flex direction="column" gap="1"><Text size="2">科目</Text><FormSelect ariaLabel="科目" value={subject} options={[{ value: '', label: '请选择科目' }, ...SUBJECTS]} onValueChange={value => { setSubject(value); setEntryId(''); setStartId(null) }} /></Flex>
            {subject && <>
              <Flex direction="column" gap="1"><Text size="2">内容</Text><FormSelect ariaLabel="内容" value={entry?.id ?? ''} options={[{ value: '', label: '请选择内容' }, ...entries.map((item: PracticeEntry) => ({ value: item.id, label: item.name }))]} onValueChange={selectEntry} /></Flex>
              {!entries.length && !api.error && !refreshError && <Text color="gray">该科目还没有已保存的内容，请先在作业内容管理中添加。</Text>}
            </>}
            {entry && parameterized && binding && <PracticeStartPicker key={`${entry.id}:${entry.updated_at}`} purpose="content" value={binding} onChange={value => setStartId(value.startId)} />}
          </Flex>
        </StickerCard>
        {selectionReady && entry ? <HomeworkContentPanel key={`${entry.id}:${selectedRow?.id ?? 'fixed'}:${entry.updated_at}`} name={entry.name} row={selectedRow} href={href} error={contentError} /> : <Text size="2" color="gray">{entry && parameterized && !entry.rows.length ? '此内容还没有具体项目，请先在作业内容管理中补充。' : '选中具体内容后，内容面板会直接显示在这里。'}</Text>}
      </>}
    </Flex>
  </PageShell>
}

export default function HomeworkContentDemo() {
  const api = usePracticeEntries()
  return <RealContentPreview key={api.user?.id ?? 'signed-out'} api={api} />
}
