'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, SegmentedControl, Text } from '@rosie/ui/themes'
import { adminCatalogStore, type AdminExamItem } from '../client/adminCatalog'
import { examErrorMessage } from '../client/examApi'

const STATUSES = { draft: '草稿', published: '已发布', withdrawn: '已下架' } as const
const KINDS: Record<AdminExamItem['kind'], string> = {
  official_paper: '真题',
  mock_paper: '模拟题',
  training_unit: '专项训练',
}

function isCatalogStatus(value: string): value is AdminExamItem['status'] {
  return Object.hasOwn(STATUSES, value)
}

export function AdminExamsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<AdminExamItem['status']>('draft')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const store = useMemo(() => adminCatalogStore(status, page), [status, page])
  const { data, isLoading, error } = store.useSessionData(user)

  async function refresh() {
    if (!user || refreshing) return
    setRefreshing(true)
    setRefreshError(null)
    try { await store.refreshInBackground(user.id) }
    catch (reason) { setRefreshError(reason) }
    finally { setRefreshing(false) }
  }

  return (
    <PageShell title="考试管理" tone="paper" width="narrow">
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex align="center" gap="2" wrap="wrap">
            <SegmentedControl.Root value={status} size="2" aria-label="内容状态" onValueChange={value => {
              if (!isCatalogStatus(value)) return
              setStatus(value)
              setPage(1)
              setRefreshError(null)
            }}>
              {(Object.keys(STATUSES) as AdminExamItem['status'][]).map(value => (
                <SegmentedControl.Item key={value} value={value}>{STATUSES[value]}</SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
            <Button size="2" variant="soft" loading={refreshing} onClick={() => void refresh()}>刷新</Button>
          </Flex>
          <Flex align="center" gap="2" wrap="wrap">
            <Button size="2" variant="soft" asChild><Link href="/admin/exams/images">图片任务 · 对照裁切</Link></Button>
            <Button size="2" variant="soft" asChild><Link href="/admin/exams/attempts">选择用户并批改考试</Link></Button>
          </Flex>
        </Flex>
        {error || refreshError ? <StickerCard tone="danger" elevation="flat"><Text as="p" role="alert">{examErrorMessage(error ?? refreshError)}</Text></StickerCard> : null}
        <div className="relative flex min-h-[calc(100dvh-16rem)] flex-col gap-4">
          <LoadingOverlay appearance="quiet" visible={isLoading} placement="content" />
          {!isLoading && !error && data.items.length === 0 ? (
            <StickerCard as="section" size="lg"><Text as="p">{status === 'draft' ? '还没有草稿。导入内容包后，可在这里对照来源编辑和审核。' : `还没有${STATUSES[status]}的内容。`}</Text></StickerCard>
          ) : null}
          {!isLoading && data.items.map(item => (
            <StickerCard key={item.revisionId} as="article" size="lg">
              <Flex direction="column" gap="3">
                <Flex justify="between" align="start" gap="3" wrap="wrap">
                  <Text as="p" size="4" weight="bold">{item.title}</Text>
                  <Flex gap="2" wrap="wrap">
                    <Badge variant="soft" radius="full" color={item.kind === 'official_paper' ? 'green' : item.kind === 'mock_paper' ? 'blue' : 'gray'}>{KINDS[item.kind]}</Badge>
                    <Badge variant="soft" radius="full">{STATUSES[item.status]} · 第 {item.revision} 版</Badge>
                  </Flex>
                </Flex>
                <Text as="p" size="2" color="gray">{item.source.title} · {item.purpose === 'reserved' ? '保留测评' : '日常训练'}</Text>
                <Flex><Button asChild size="3" variant="soft"><Link href={`/admin/exams/${encodeURIComponent(item.revisionId)}`}>{item.status === 'draft' ? '编辑与审核' : '查看发布状态'}</Link></Button></Flex>
              </Flex>
            </StickerCard>
          ))}
        </div>
        <Flex align="center" justify="between" gap="3">
          <Button size="3" variant="soft" disabled={page === 1 || isLoading} onClick={() => setPage(value => value - 1)}>上一页</Button>
          <Text size="2">第 {page} 页</Text>
          <Button size="3" variant="soft" disabled={!data.hasMore || isLoading} onClick={() => setPage(value => value + 1)}>下一页</Button>
        </Flex>
      </Flex>
    </PageShell>
  )
}
