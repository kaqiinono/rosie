'use client'

import { useState } from 'react'
import { Box, Button, Flex, Text } from '@rosie/ui/themes'
import type { SyncDirectoryPage } from '@/app/api/baidu/sync/directories/route'
import type { SyncChosenDirectory } from './SyncDirectoryChooser'
import { SyncPending } from './SyncControls'
import { useExamSyncQuery } from './ExamSyncRequest'

export default function ExamMediaFiles({ userId, generation, main, disabled, choose }: {
  userId: string; generation: string; main: SyncChosenDirectory; disabled: boolean
  choose: (file: { id: string; path: string; name: string }) => void
}) {
  const [path, setPath] = useState(main.path)
  const [start, setStart] = useState(0)
  const url = '/api/baidu/sync/directories?' + new URLSearchParams({ id: main.directory_id, path, generation, start: String(start) })
  const query = useExamSyncQuery<SyncDirectoryPage>(userId, url)
  function open(next: string) { setPath(next); setStart(0) }
  return <Flex direction="column" gap="2">
    <Flex gap="2" align="center" justify="between" wrap="wrap">
      <Text size="2" className="break-all">{path}</Text>
      <Button variant="soft" size="1" loading={query.refreshing} disabled={disabled || query.loading} onClick={() => void query.refresh().catch(() => undefined)}>刷新文件</Button>
    </Flex>
    {path !== main.path && <Button variant="soft" size="1" disabled={disabled} onClick={() => open(path.slice(0, path.lastIndexOf('/')) || '/')}>上一级</Button>}
    {query.loading && <SyncPending>正在读取目录文件…</SyncPending>}
    {query.error && <Text size="2" color="red" role="alert">{query.error}</Text>}
    {query.data && <>
      {!query.data.entries.length && <Text size="2" color="gray">这个目录没有文件。</Text>}
      <Box maxHeight="48vh" overflowY="auto">
        <Flex direction="column" gap="2">
          {query.data.entries.map(entry => {
            const full = (path === '/' ? '' : path) + '/' + entry.name
            return <Flex key={entry.name} gap="2" align="center" justify="between">
              <Text size="2" className="min-w-0 break-all">{entry.folder ? '文件夹 · ' : ''}{entry.name}</Text>
              <Button variant="soft" size="1" disabled={disabled || (!entry.folder && !entry.fileId)}
                aria-label={(entry.folder ? '打开 ' : '选择 ') + entry.name}
                onClick={() => { if (entry.folder) open(full); else if (entry.fileId) choose({ id: entry.fileId, path: full, name: entry.name }) }}>
                {entry.folder ? '打开' : '选择'}
              </Button>
            </Flex>
          })}
        </Flex>
      </Box>
      <Flex gap="2">
        <Button size="1" variant="soft" disabled={disabled || query.data.previous === null} onClick={() => setStart(query.data?.previous ?? 0)}>上一页</Button>
        <Button size="1" variant="soft" disabled={disabled || query.data.next === null} onClick={() => setStart(query.data?.next ?? 0)}>下一页</Button>
      </Flex>
    </>}
  </Flex>
}
