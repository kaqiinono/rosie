'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createUserSessionStore, useAuth } from '@rosie/core'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Text, TextField } from '@rosie/ui/themes'
import { examRequest, ExamRequestError } from '../client/examApi'
import { ExamGradingPanel } from '../components/ExamGradingPanel'
import { ExamGroupRenderer } from '../components/ExamGroupRenderer'
import type { ExamAttemptListItem, ExamAttemptView } from '../types/attempts'

interface AdminAttemptList { userId: string; items: ExamAttemptListItem[] }
interface AdminAttemptView extends ExamAttemptView { adminRevisionId: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const listStores = new Map<string, ReturnType<typeof createUserSessionStore<AdminAttemptList>>>()
const detailStores = new Map<string, ReturnType<typeof createUserSessionStore<AdminAttemptView | null>>>()
function listStore(ownerId: string) {
  let store = listStores.get(ownerId)
  if (!store) {
    store = createUserSessionStore<AdminAttemptList>(`admin-exam-attempts:${ownerId}`, {
      empty: { userId: ownerId, items: [] }, fetch: userId => examRequest(userId, `/api/admin/exams/attempts?userId=${encodeURIComponent(ownerId)}`),
    })
    listStores.set(ownerId, store)
  }
  return store
}
function detailStore(ownerId: string, attemptId: string) {
  const key = `${ownerId}:${attemptId}`
  let store = detailStores.get(key)
  if (!store) {
    store = createUserSessionStore<AdminAttemptView | null>(`admin-exam-attempt:${key}`, {
      empty: null, fetch: async userId => {
        const [view] = await Promise.all([
          examRequest<AdminAttemptView>(userId, `/api/admin/exams/attempts/${attemptId}?userId=${encodeURIComponent(ownerId)}`),
          examRequest(userId, '/api/exams/media/session', { method: 'POST' }),
        ])
        return view
      },
    })
    detailStores.set(key, store)
  }
  return store
}
function errorMessage(error: unknown): string {
  if (error instanceof ExamRequestError) {
    if (error.status === 401) return '登录已过期，请重新登录。'
    if (error.status === 403) return '当前账号没有管理员批改权限。'
    if (error.status === 404) return '此用户没有该会话，请重新选择目标用户和记录。'
    if (error.status === 400) return '请填写完整有效的用户 ID。'
  }
  return '暂时无法读取批改记录，请重试。'
}
const statusNames = { ready: '尚未开始', active: '尚未完成', pending_review: '待人工批改', completed: '已完成' } as const

export function AdminExamAttemptsPage() {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [attemptId, setAttemptId] = useState('')
  const [inputError, setInputError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [limit, setLimit] = useState(20)
  const lists = useMemo(() => listStore(ownerId), [ownerId])
  const details = useMemo(() => detailStore(ownerId, attemptId), [ownerId, attemptId])
  const list = lists.useSessionData(ownerId ? user : null)
  const detail = details.useSessionData(ownerId && attemptId ? user : null)
  const view = detail.data
  const error = list.error ?? detail.error
  async function refresh() {
    if (!user || !ownerId || refreshing) return
    setRefreshing(true)
    try { await Promise.all([lists.refreshInBackground(user.id), ...(attemptId ? [details.refreshInBackground(user.id)] : [])]) }
    catch { /* Session stores retain their respective errors and prior data. */ }
    finally { setRefreshing(false) }
  }
  return <PageShell title="管理员考试批改" tone="paper" width="default"><Flex direction="column" gap="5">
    <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">明确选择目标用户</Heading>
      <Text as="p" size="2">从账号管理复制需要批改的用户 ID。只有点击加载后才读取该用户的考试记录。</Text>
      <Button size="3" variant="soft" asChild><Link href="/admin/users">打开账号管理</Link></Button>
      <form noValidate onSubmit={event => {
        event.preventDefault()
        const id = input.trim()
        if (!UUID.test(id)) { setInputError('请输入完整的 UUID 用户 ID。'); return }
        setInputError(''); setOwnerId(id.toLowerCase()); setAttemptId(''); setLimit(20)
      }}><Flex direction="column" gap="3"><TextField.Root size="3" aria-label="目标用户 ID" aria-invalid={!!inputError} aria-describedby={inputError ? 'admin-exam-owner-error' : undefined}
        placeholder="例如：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" value={input} onChange={event => { setInput(event.target.value); setInputError('') }} />
        {inputError && <Text id="admin-exam-owner-error" size="2" color="red" role="alert">{inputError}</Text>}
        <Flex gap="3" wrap="wrap"><Button type="submit" size="3" loading={list.isLoading}>加载用户记录</Button>
          {!!input && <Button type="button" size="3" variant="soft" onClick={() => { setInput(''); setOwnerId(''); setAttemptId(''); setInputError('') }}>清除选择</Button>}
          {!!ownerId && <Button type="button" size="3" variant="soft" loading={refreshing} onClick={() => void refresh()}>{error ? '重试读取' : '刷新记录'}</Button>}</Flex>
      </Flex></form>
      {!!ownerId && <Text size="2" className="break-all">当前目标用户：{ownerId}</Text>}
      {refreshing && <Text size="2" role="status">正在更新记录与批改结果…</Text>}
    </Flex></StickerCard>
    {error ? <StickerCard tone="danger" elevation="flat"><Text role="alert">{errorMessage(error)}</Text></StickerCard> : null}
    <div className="relative flex min-h-[calc(100dvh-26rem)] flex-col gap-5"><LoadingOverlay appearance="quiet" visible={list.isLoading || detail.isLoading} placement="content" />
      {ownerId && !list.isLoading && !list.error && <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">选择考试会话</Heading>
        {!list.data.items.length && <Text>该用户当前没有考试记录。</Text>}
        {list.data.items.slice(0, limit).map(item => <Flex key={item.id} gap="3" wrap="wrap" align="center" justify="between"><Flex direction="column" gap="1"><Text weight="bold">{item.title}</Text>
          <Text size="2" color="gray" className="break-all">{new Date(item.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {item.id}</Text>
          <Flex gap="2" wrap="wrap"><Badge variant="soft" radius="full">{item.mode === 'mock' ? '模考' : '练习'}</Badge><Badge variant="soft" radius="full">{statusNames[item.status]}</Badge></Flex></Flex>
          <Button size="3" variant={attemptId === item.id ? 'solid' : 'soft'} aria-pressed={attemptId === item.id} onClick={() => setAttemptId(item.id)}>查看已提交部分</Button></Flex>)}
        {list.data.items.length > limit && <Button size="3" variant="soft" onClick={() => setLimit(value => value + 20)}>显示更多会话</Button>}
        {list.data.items.length === 100 && <Text size="2" color="gray">当前列出最近 100 次会话。</Text>}
      </Flex></StickerCard>}
      {attemptId && view && !detail.isLoading && <>
        <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Heading as="h2" size="5">{view.title}</Heading>
          <Text size="2">这里只展示已提交的题目和保存答案。未提交的科目不会开放给批改界面。</Text>
          {!view.groups.length && <Text>此会话还没有已提交的科目，暂时不能批改。</Text>}
        </Flex></StickerCard>
        {view.groups.map(group => <StickerCard key={group.id} as="article" size="lg"><Flex direction="column" gap="5"><Heading as="h3" size="4">{group.sectionId} · Part {group.partNumber}</Heading>
          <ExamGroupRenderer audio={{ slots: view.mediaSlots }} group={group} materials={view.materials} attemptId={view.id} adminRevisionId={view.adminRevisionId}
            answers={view.state.answers} annotations={view.state.annotations ?? {}} results={view.state.results} disabled onAnswer={() => undefined}
            renderSpeaking={() => <Text size="2">口语录音请在下方批改面板选择对应题目后回放。</Text>} />
        </Flex></StickerCard>)}
        <ExamGradingPanel key={`${ownerId}:${view.id}`} attemptId={view.id} view={view} ownerId={ownerId} onSaved={() => void refresh()} />
      </>}
    </div>
  </Flex></PageShell>
}
