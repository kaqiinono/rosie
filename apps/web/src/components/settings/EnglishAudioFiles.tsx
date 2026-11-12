'use client'

import { useEffect, useState } from 'react'
import { Box, Button, Flex, Separator, Text, TextField } from '@rosie/ui/themes'
import { lessonAudioMime } from '@rosie/english/utils/reading-audio-types'
import type { SyncDirectoryPage } from '@/app/api/baidu/sync/directories/route'
import { directoryPrefix, type LessonAudioDirectory, type LessonAudioPick, type LessonInventoryFile } from '@/lib/english-audio-types'
import { request } from './EnglishSyncRequest'
import { SyncPending } from './SyncControls'

export { DirectoryChooser, type SyncChosenDirectory } from './SyncDirectoryChooser'

function directoryUrl(id: string, path: string, generation: string, start: number) {
  return '/api/baidu/sync/directories?' + new URLSearchParams({ id, path, generation, start: String(start) })
}

type FileListProps = {
  main: LessonAudioDirectory
  inventory: ReturnType<typeof useEnglishFileInventory>
  disabled: boolean
  choose: (pick: LessonAudioPick) => void
}

export function useEnglishFileInventory(userId: string, generation: string, main: LessonAudioDirectory | null) {
  const [result, setResult] = useState<{ key: string; files: LessonInventoryFile[]; ready: boolean; error: string }>()
  const [attempt, setAttempt] = useState(0)
  const id = main?.directory_id
  const path = main?.path
  const key = JSON.stringify([userId, generation, id, path, attempt])
  useEffect(() => {
    setResult(undefined)
    if (!id || !path) return
    const controller = new AbortController()
    const files: LessonInventoryFile[] = []
    async function scan(rootId: string, rootPath: string) {
      const directories = [rootPath]
      const visited = new Set(directories)
      for (const directory of directories) {
        let offset: number | null = 0
        do {
          const result: SyncDirectoryPage = await request(userId, directoryUrl(rootId, directory, generation, offset), controller.signal)
          if (controller.signal.aborted) return
          const batch: LessonInventoryFile[] = []
          for (const entry of result.entries) {
            const full = directoryPrefix(directory) + entry.name
            if (entry.folder) {
              if (!visited.has(full)) { visited.add(full); directories.push(full) }
            } else {
              batch.push({ name: entry.name, directory, fileId: entry.fileId })
            }
          }
          if (batch.length) {
            files.push(...batch)
            setResult({ key, files: files.slice(), ready: false, error: '' })
          }
          offset = result.next
        } while (offset !== null)
      }
    }
    void scan(id, path).then(() => {
      if (!controller.signal.aborted) setResult({ key, files, ready: true, error: '' })
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setResult({ key, files, ready: false, error: reason instanceof Error ? reason.message : '文件列表读取失败。' })
    })
    return () => controller.abort()
  }, [userId, generation, id, path, key])

  const current = result?.key === key ? result : undefined
  return { files: current?.files ?? [], ready: current?.ready ?? false, error: current?.error ?? '', refresh: () => setAttempt(n => n + 1) }
}

export function EnglishFileList({ inventory, main, disabled, choose }: FileListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { directory_id: id, path } = main
  const { files, ready, error } = inventory
  const loading = !ready && !error
  const query = search.trim().toLowerCase()
  const matches = query ? files.filter(file => (directoryPrefix(file.directory) + file.name).toLowerCase().includes(query)) : files
  const pageSize = 50
  return <Flex direction="column" gap="2">
    <TextField.Root placeholder="搜索文件名或路径" aria-label="搜索文件名或路径" value={search}
      onChange={event => { setSearch(event.target.value); setPage(0) }} />
    <Flex justify="between" align="center" gap="2">
      <Text size="1" color="gray">{matches.length} 个文件</Text>
      <Button size="1" color="gray" variant="soft" disabled={loading} onClick={() => { setPage(0); inventory.refresh() }}>
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
