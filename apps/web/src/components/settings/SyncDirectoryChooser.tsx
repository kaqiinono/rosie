'use client'

import { useState } from 'react'
import { Box, Button, Card, Flex, Heading, Text } from '@rosie/ui/themes'
import type { SyncDirectoryList, SyncDirectoryPage } from '@/app/api/baidu/sync/directories/route'
import { LoadStatus, useQuery } from './EnglishSyncRequest'
import { SyncSelect } from './SyncControls'

export type SyncChosenDirectory = { directory_id: string; path: string }

function directoryUrl(id: string, path: string, generation: string, start: number) {
  return '/api/baidu/sync/directories?' + new URLSearchParams({ id, path, generation, start: String(start) })
}

function directoryPrefix(path: string) {
  return path === '/' ? '/' : path + '/'
}

type ChooserProps = {
  userId: string
  paths: SyncDirectoryList
  initial: SyncChosenDirectory | null
  disabled: boolean
  cancel?: () => void
  choose: (main: SyncChosenDirectory) => void
}

type MainDirectoryProps = {
  userId: string
  paths: SyncDirectoryList
  main: SyncChosenDirectory | null
  disabled: boolean
  choosing: boolean
  onChoosingChange: (choosing: boolean) => void
  onChoose: (directory: SyncChosenDirectory) => void
  onClear: () => void
}

export function CourseMainDirectory({
  userId, paths, main, disabled, choosing, onChoosingChange, onChoose, onClear,
}: MainDirectoryProps) {
  return (
    <Card>
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between" gap="2" wrap="wrap">
          <Box minWidth="0">
            <Heading as="h3" size="3">课程主目录</Heading>
            {main && <Text as="p" size="2" color="gray" truncate title={main.path}>{main.path}</Text>}
          </Box>
          <Flex gap="2">
            {main && (
              <Button variant="soft" color="gray" size="1" disabled={disabled} onClick={onClear}>
                解除主目录
              </Button>
            )}
            {!choosing && (
              <Button variant="soft" size="1" disabled={disabled} onClick={() => onChoosingChange(true)}>
                更换目录
              </Button>
            )}
          </Flex>
        </Flex>
        {choosing && (
          <DirectoryChooser
            userId={userId}
            paths={paths}
            initial={main}
            disabled={disabled}
            cancel={main ? () => onChoosingChange(false) : undefined}
            choose={onChoose}
          />
        )}
      </Flex>
    </Card>
  )
}

export function DirectoryChooser({ userId, paths, initial, disabled, cancel, choose }: ChooserProps) {
  const [id, setId] = useState(initial?.directory_id ?? '')
  const [path, setPath] = useState(initial?.path ?? '')
  const [start, setStart] = useState(0)
  const root = paths.directories.find((row) => row.id === id)
  const page = useQuery<SyncDirectoryPage>(userId, root ? directoryUrl(id, path, paths.generation, start) : '')
  function open(next: string) {
    setPath(next)
    setStart(0)
  }
  return (
    <Flex direction="column" gap="2">
      <SyncSelect
        layout="inline"
        label="授权路径"
        value={id}
        empty="选择已收藏的路径"
        disabled={disabled || !paths.directories.length}
        options={paths.directories.map((row) => ({ value: row.id, label: row.path }))}
        onValueChange={(value) => {
          setId(value)
          open(paths.directories.find((row) => row.id === value)?.path ?? '')
        }}
      />
      {!paths.directories.length && <Text size="2" color="gray">请先在「路径」中添加课程所在目录。</Text>}
      {root && (
        <>
          <Flex align="center" gap="2" wrap="wrap">
            <Text size="2" color="gray" className="min-w-0 break-all">
              {path}
            </Text>
            {path !== root.path && (
              <Button
                variant="soft"
                color="gray"
                size="1"
                disabled={disabled}
                onClick={() => open(path.slice(0, path.lastIndexOf('/')) || '/')}
              >
                上一级
              </Button>
            )}
          </Flex>
          <LoadStatus {...page} />
          {page.data && (
            <Flex gap="2" wrap="wrap">
              {page.data.entries
                .filter((entry) => entry.folder)
                .map((entry) => (
                  <Button
                    key={entry.name}
                    size="1"
                    variant="surface"
                    disabled={disabled}
                    aria-label={'打开子目录 ' + entry.name}
                    onClick={() => open(directoryPrefix(path) + entry.name)}
                  >
                    {entry.name}
                  </Button>
                ))}
              {(['previous', 'next'] as const).map((key) => {
                const offset = page.data?.[key]
                return (
                  typeof offset === 'number' && (
                    <Button key={key} size="1" color="gray" variant="soft" disabled={disabled} onClick={() => setStart(offset)}>
                      {key === 'next' ? '下一页' : '上一页'}
                    </Button>
                  )
                )
              })}
            </Flex>
          )}
          {/* 先浏览子目录，再确认；确认放在列表下方，避免夹在路径和目录标签中间 */}
          <Flex gap="2" wrap="wrap">
            <Button variant="soft" disabled={disabled || !page.data} onClick={() => choose({ directory_id: id, path })}>
              使用此目录
            </Button>
            {cancel && (
              <Button variant="soft" color="gray" disabled={disabled} onClick={cancel}>
                取消更换
              </Button>
            )}
          </Flex>
        </>
      )}
      {!root && cancel && (
        <Box>
          <Button variant="soft" color="gray" size="1" disabled={disabled} onClick={cancel}>
            取消更换
          </Button>
        </Box>
      )}
    </Flex>
  )
}
