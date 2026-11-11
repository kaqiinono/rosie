'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase, useAuth } from '@rosie/core'
import type {
  SyncDirectory,
  SyncDirectoryList,
  SyncDirectoryPage,
} from '@/app/api/baidu/sync/directories/route'
import dynamic from 'next/dynamic'
import Form from 'next/form'
import type { User } from '@supabase/supabase-js'
import { LoadingOverlay } from '@rosie/ui'
import { Box, Button, Card, Flex, Heading, Tabs, Text, TextField } from '@rosie/ui/themes'
import BaiduOAuthConnect from './BaiduOAuthConnect'
import { useSyncAuthorization } from './BaiduOAuthStatus'
import { SyncPending, useSyncConfirmation } from './SyncControls'

const loading = () => <SyncPending />
const BaiduMathVideoManager = dynamic(() => import('./BaiduMathVideoManager'), { loading })
const EnglishAudioManager = dynamic(() => import('./EnglishAudioManager'), { loading })
const tabs = ['路径', '数学', '英语'] as const
type SyncTab = (typeof tabs)[number]

type OpenDirectory = SyncDirectoryPage & { root: SyncDirectory }

async function requestDirectories(
  userId: string,
  signal: AbortSignal,
  query: Record<string, string> = {},
  method = 'GET',
  path?: string,
) {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw Error('登录已过期，请重新登录。')
  const response = await fetch('/api/baidu/sync/directories?' + new URLSearchParams(query), {
    method,
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    headers: {
      Authorization: 'Bearer ' + data.session.access_token,
      'Content-Type': 'application/json',
    },
    body: path === undefined ? undefined : JSON.stringify({ path }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw Error(typeof result?.error === 'string' ? result.error : '请求失败，请重试。')
  }
  return response
}

export default function BaiduSyncDirectories() {
  const { user } = useAuth()
  return user ? <SyncWorkspace key={user.id} user={user} /> : null
}

function SyncWorkspace({ user }: { user: User }) {
  const userId = user.id
  const authorization = useSyncAuthorization(user)
  const [tab, setTab] = useState<SyncTab>('路径')
  const panel = useRef<HTMLDivElement>(null)
  const { confirm, dialog } = useSyncConfirmation()
  const [list, setList] = useState<SyncDirectoryList | null>(null)
  const [opened, setOpened] = useState<OpenDirectory | null>(null)
  const [input, setInput] = useState('')
  const [operation, setOperation] = useState('')
  const busy = Boolean(operation)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const fileListHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (opened) fileListHeading.current?.focus()
  }, [opened])

  const run = useCallback(
    async <T,>(
      operation: string,
      load: (signal: AbortSignal) => Promise<T>,
      apply: (result: T) => void,
    ) => {
      if (pending.current) return
      const controller = new AbortController()
      pending.current = controller
      setOperation(operation)
      setError('')
      try {
        const result = await load(controller.signal)
        if (!controller.signal.aborted) apply(result)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error && cause.name === 'Error'
              ? cause.message
              : '请求未完成，请检查网络后重试。',
          )
          setOpened(null)
        }
      } finally {
        if (pending.current === controller) {
          pending.current = null
          setOperation('')
        }
      }
    },
    [],
  )

  const refresh = useCallback(() => {
    if (!userId) return
    setOpened(null)
    return run<SyncDirectoryList>(
      'refresh',
      async (signal) => (await requestDirectories(userId, signal)).json(),
      setList,
    )
  }, [userId, run])

  useEffect(() => {
    void refresh()
    return () => {
      pending.current?.abort()
      pending.current = null
    }
  }, [refresh])

  function add(event: FormEvent) {
    event.preventDefault()
    if (!userId || !list || !input.trim()) return
    void run<SyncDirectory>(
      'add',
      async (signal) =>
        (
          await requestDirectories(
            userId,
            signal,
            { generation: list.generation },
            'POST',
            input.trim(),
          )
        ).json(),
      (directory) => {
        setList({
          ...list,
          directories: [...list.directories, directory].sort((a, b) =>
            a.path.localeCompare(b.path),
          ),
        })
        setInput('')
      },
    )
  }

  function remove(root: SyncDirectory) {
    if (!userId || !list) return
    void run(
      'remove:' + root.id,
      (signal) =>
        requestDirectories(userId, signal, { generation: list.generation, id: root.id }, 'DELETE'),
      () => {
        setList({ ...list, directories: list.directories.filter((item) => item.id !== root.id) })
        if (opened?.root.id === root.id) setOpened(null)
      },
    )
  }

  function browse(root: SyncDirectory, path = root.path, start = 0) {
    if (!userId || !list) return
    const query = { generation: list.generation, id: root.id, path, start: String(start) }
    void run<SyncDirectoryPage>(
      'browse',
      async (signal) => (await requestDirectories(userId, signal, query)).json(),
      (page) => setOpened({ ...page, root }),
    )
  }

  if (authorization.isLoading || (!list && !error))
    return <LoadingOverlay visible placement="content" />

  function switchTab(value: string) {
    const next = tabs.find((item) => item === value)
    if (!next || next === tab || busy || panel.current?.querySelector('[data-sync-saving="true"]'))
      return
    if (panel.current?.querySelector('[data-sync-dirty="true"]'))
      confirm('放弃尚未保存的修改并切换标签？', () => setTab(next))
    else setTab(next)
  }

  return (
    <BaiduOAuthConnect target="shared" authorization={authorization}>
      <Card size="3" className="flex flex-1 flex-col">
        <Tabs.Root
          ref={panel}
          value={tab}
          onValueChange={switchTab}
          activationMode="manual"
          className="flex flex-1 flex-col"
        >
          <Tabs.List aria-label="同步模块">
            {tabs.map((item) => (
              <Tabs.Trigger key={item} value={item} disabled={busy}>
                {item}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Box position="relative" flexGrow="1" minHeight="18rem">
            {tabs.map((item) => (
              <Tabs.Content
                value={item}
                key={item}
                className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable]"
              >
                <Box pt="4">
                  {error && (
                    <Text as="p" size="2" color="red" role="alert" mb="2">
                      {error}
                    </Text>
                  )}
                  {!list ? (
                    <Button variant="soft" disabled={busy} onClick={() => void refresh()}>
                      重新读取授权路径
                    </Button>
                  ) : item === '数学' ? (
                    <BaiduMathVideoManager key={list.generation} paths={list} />
                  ) : item === '英语' ? (
                    <EnglishAudioManager key={list.generation} userId={userId} paths={list} />
                  ) : (
                    <Flex direction="column" gap="3">
                      <Flex align="center" justify="between" gap="2" wrap="wrap">
                        <Heading as="h2" size="4">
                          授权路径
                        </Heading>
                        <Button
                          variant="soft"
                          disabled={busy}
                          loading={operation === 'refresh'}
                          onClick={() => void refresh()}
                        >
                          刷新路径列表
                        </Button>
                      </Flex>
                      <Text size="2" color="gray">
                        添加共享网盘中需要浏览的目录。移除路径仅删除此处的配置。
                      </Text>
                      <Form action="" onSubmit={add}>
                        <Flex gap="2" align="end" wrap="wrap">
                          <Box flexGrow="1">
                            <Text as="label" htmlFor="sync-path" size="2" weight="medium">
                              网盘目录
                            </Text>
                            <TextField.Root
                              id="sync-path"
                              mt="1"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              required
                              disabled={busy}
                              placeholder="/airosie/math"
                              autoComplete="off"
                            />
                          </Box>
                          <Button
                            type="submit"
                            disabled={busy || !input.trim()}
                            loading={operation === 'add'}
                          >
                            添加路径
                          </Button>
                        </Flex>
                      </Form>
                      {!list.directories.length && (
                        <Text size="2" color="gray">
                          尚未添加授权路径。
                        </Text>
                      )}
                      <Flex direction="column" gap="2" role="list">
                        {list.directories.map((root) => (
                          <Flex key={root.id} role="listitem" align="center" gap="2" wrap="wrap">
                            <Box flexGrow="1" minWidth="0">
                              <Text size="2" wrap="pretty" className="break-all">
                                {root.path}
                              </Text>
                            </Box>
                            <Button
                              variant="soft"
                              disabled={busy}
                              onClick={() => browse(root)}
                              aria-label={'查看 ' + root.path + ' 的文件列表'}
                            >
                              查看
                            </Button>
                            <Button
                              variant="soft"
                              color="red"
                              disabled={busy}
                              loading={operation === 'remove:' + root.id}
                              onClick={() => remove(root)}
                              aria-label={'移除路径 ' + root.path}
                            >
                              移除
                            </Button>
                          </Flex>
                        ))}
                      </Flex>
                      {operation === 'browse' && <SyncPending>正在读取文件列表…</SyncPending>}
                      {opened && (
                        <Card>
                          <Flex direction="column" gap="2" align="start">
                            <Heading
                              as="h3"
                              size="3"
                              ref={fileListHeading}
                              tabIndex={-1}
                              className="break-all"
                            >
                              文件列表　{opened.path}
                            </Heading>
                            {opened.path !== opened.root.path && (
                              <Button
                                variant="soft"
                                disabled={busy}
                                onClick={() =>
                                  browse(
                                    opened.root,
                                    opened.path.slice(0, opened.path.lastIndexOf('/')) || '/',
                                  )
                                }
                              >
                                返回上一级
                              </Button>
                            )}
                            {!opened.entries.length && (
                              <Text size="2" color="gray">
                                此目录为空。
                              </Text>
                            )}
                            {opened.entries.map((entry) =>
                              entry.folder ? (
                                <Button
                                  key={entry.name}
                                  variant="soft"
                                  disabled={busy}
                                  onClick={() =>
                                    browse(
                                      opened.root,
                                      (opened.path === '/' ? '' : opened.path) + '/' + entry.name,
                                    )
                                  }
                                >
                                  {entry.name}
                                </Button>
                              ) : (
                                <Text key={entry.name} size="2" className="break-all">
                                  {entry.name}
                                </Text>
                              ),
                            )}
                            {(opened.previous !== null || opened.next !== null) && (
                              <Flex gap="2">
                                <Button
                                  variant="soft"
                                  disabled={busy || opened.previous === null}
                                  onClick={() =>
                                    browse(opened.root, opened.path, opened.previous ?? 0)
                                  }
                                >
                                  上一页
                                </Button>
                                <Button
                                  variant="soft"
                                  disabled={busy || opened.next === null}
                                  onClick={() => browse(opened.root, opened.path, opened.next ?? 0)}
                                >
                                  下一页
                                </Button>
                              </Flex>
                            )}
                          </Flex>
                        </Card>
                      )}
                    </Flex>
                  )}
                </Box>
              </Tabs.Content>
            ))}
          </Box>
        </Tabs.Root>
        {dialog}
      </Card>
    </BaiduOAuthConnect>
  )
}
