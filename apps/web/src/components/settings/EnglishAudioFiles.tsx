'use client'

import { useEffect, useState } from 'react'
import { Box, Button, Flex, Separator, Text, TextField } from '@rosie/ui/themes'
import { lessonAudioMime } from '@rosie/english/utils/reading-audio-types'
import type { SyncDirectoryList, SyncDirectoryPage } from '@/app/api/baidu/sync/directories/route'
import { directoryPrefix, type LessonAudioDirectory, type LessonAudioPick } from '@/lib/english-audio-types'
import { LoadStatus, request, useQuery } from './EnglishSyncRequest'
import { SyncPending, SyncSelect } from './SyncControls'

function directoryUrl(id: string, path: string, generation: string, start: number) {
  return '/api/baidu/sync/directories?' + new URLSearchParams({ id, path, generation, start: String(start) })
}

type ChooserProps = {
  userId: string
  paths: SyncDirectoryList
  initial: LessonAudioDirectory | null
  disabled: boolean
  cancel?: () => void
  choose: (main: LessonAudioDirectory) => void
}

export function DirectoryChooser({ userId, paths, initial, disabled, cancel, choose }: ChooserProps) {
  const [id, setId] = useState(initial?.directory_id ?? '')
  const [path, setPath] = useState(initial?.path ?? '')
  const [start, setStart] = useState(0)
  const root = paths.directories.find(row => row.id === id)
  const page = useQuery<SyncDirectoryPage>(userId, root ? directoryUrl(id, path, paths.generation, start) : '')
  function open(next: string) { setPath(next); setStart(0) }
  return <Flex direction="column" gap="2">
    <SyncSelect label="授权路径" value={id} empty="选择已收藏的路径" disabled={disabled || !paths.directories.length}
      options={paths.directories.map(row => ({ value: row.id, label: row.path }))}
      onValueChange={value => { setId(value); open(paths.directories.find(row => row.id === value)?.path ?? '') }} />
    {!paths.directories.length && <Text size="2" color="gray">请先在「路径」中添加课程所在目录。</Text>}
    {root && <>
      <Text size="2" color="gray">{path}</Text>
      <Flex gap="2" wrap="wrap">
        <Button variant="soft" disabled={disabled || !page.data} onClick={() => choose({ directory_id: id, path })}>使用此目录</Button>
        {path !== root.path && <Button variant="soft" color="gray" disabled={disabled}
          onClick={() => open(path.slice(0, path.lastIndexOf('/')) || '/')}>上一级</Button>}
      </Flex>
      <LoadStatus {...page} />
      {page.data && <Flex gap="2" wrap="wrap">
        {page.data.entries.filter(entry => entry.folder).map(entry => <Button key={entry.name} size="1" variant="surface"
          disabled={disabled} aria-label={'打开子目录 ' + entry.name} onClick={() => open(directoryPrefix(path) + entry.name)}>{entry.name}</Button>)}
        {(['previous', 'next'] as const).map(key => {
          const offset = page.data?.[key]
          return typeof offset === 'number' && <Button key={key} size="1" color="gray" variant="soft"
            disabled={disabled} onClick={() => setStart(offset)}>{key === 'next' ? '下一页' : '上一页'}</Button>
        })}
      </Flex>}
    </>}
    {cancel && <Box><Button variant="soft" color="gray" size="1" disabled={disabled} onClick={cancel}>取消更换</Button></Box>}
  </Flex>
}

type InventoryFile = { name: string; directory: string; fileId?: string }
type FileListProps = {
  userId: string
  generation: string
  main: LessonAudioDirectory
  disabled: boolean
  choose: (pick: LessonAudioPick) => void
}

export function EnglishFileList({ userId, generation, main, disabled, choose }: FileListProps) {
  const [files, setFiles] = useState<InventoryFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { directory_id: id, path } = main
  useEffect(() => {
    const controller = new AbortController()
    async function scan() {
      setLoading(true)
      setError('')
      setFiles([])
      setPage(0)
      const directories = [path]
      const visited = new Set(directories)
      for (const directory of directories) {
        let offset: number | null = 0
        do {
          const result: SyncDirectoryPage = await request(userId, directoryUrl(id, directory, generation, offset), controller.signal)
          if (controller.signal.aborted) return
          const batch: InventoryFile[] = []
          for (const entry of result.entries) {
            const full = directoryPrefix(directory) + entry.name
            if (entry.folder) {
              if (!visited.has(full)) { visited.add(full); directories.push(full) }
            } else {
              batch.push({ name: entry.name, directory, fileId: entry.fileId })
            }
          }
          if (batch.length) setFiles(previous => previous.concat(batch))
          offset = result.next
        } while (offset !== null)
      }
    }
    void scan().catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '文件列表读取失败。')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [userId, generation, id, path, attempt])

  const query = search.trim().toLowerCase()
  const matches = query ? files.filter(file => (directoryPrefix(file.directory) + file.name).toLowerCase().includes(query)) : files
  const pageSize = 50
  return <Flex direction="column" gap="2">
    <TextField.Root placeholder="搜索文件名或路径" aria-label="搜索文件名或路径" value={search}
      onChange={event => { setSearch(event.target.value); setPage(0) }} />
    <Flex justify="between" align="center" gap="2">
      <Text size="1" color="gray">{matches.length} 个文件</Text>
      <Button size="1" color="gray" variant="soft" disabled={loading} onClick={() => setAttempt(n => n + 1)}>
        {error ? '重试读取' : '刷新文件'}
      </Button>
    </Flex>
    {loading && <SyncPending>正在读取主目录及子目录…</SyncPending>}
    {error && <Text size="2" color="red" role="alert">文件列表读取中断。{error}</Text>}
    {!loading && !error && !matches.length && <Text size="2" color="gray">{query ? '没有匹配的文件。' : '目录中暂无文件。'}</Text>}
    <Box maxHeight="48vh" overflowY="auto">
      {matches.slice(page * pageSize, (page + 1) * pageSize).map(file => {
        const full = directoryPrefix(file.directory) + file.name
        const relative = file.directory.slice(directoryPrefix(path).length)
        const audio = Boolean(lessonAudioMime(file.name))
        return <Box key={full}>
          <Flex align="center" gap="2" py="2">
            <Box minWidth="0" flexGrow="1">
              <Text as="p" size="2" weight="medium" truncate title={file.name}>{file.name}</Text>
              <Text as="p" size="1" color="gray" truncate title={full}>{relative ? './' + relative + '/' : './'}</Text>
            </Box>
            <Button size="1" variant="soft" aria-label={'绑定 ' + full} disabled={disabled || !audio || !file.fileId}
              onClick={() => { if (file.fileId) choose({ directory_id: id, path: full, file_id: file.fileId }) }}>
              {audio ? '绑定' : '非音频'}
            </Button>
          </Flex>
          <Separator size="4" />
        </Box>
      })}
    </Box>
    {matches.length > pageSize && <Flex gap="2" align="center" justify="end">
      <Button size="1" variant="soft" disabled={!page} onClick={() => setPage(n => n - 1)}>上一页</Button>
      <Text size="1" color="gray">{page + 1} / {Math.ceil(matches.length / pageSize)}</Text>
      <Button size="1" variant="soft" disabled={(page + 1) * pageSize >= matches.length} onClick={() => setPage(n => n + 1)}>下一页</Button>
    </Flex>}
  </Flex>
}
