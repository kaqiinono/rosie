'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@rosie/core'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { attemptListStore, examCatalogStore } from '../client/learningCatalog'
import { examErrorMessage } from '../client/examApi'
import { StartExamButton } from '../components/StartExamButton'
import { wordReviewListStore } from '../vocabulary/client'

export function KetExamsPage() {
  const { user } = useAuth()
  const catalog = examCatalogStore.useSessionData(user)
  const attempts = attemptListStore.useSessionData(user)
  const wordReviews = wordReviewListStore.useSessionData(user)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const loading = catalog.isLoading || attempts.isLoading || wordReviews.isLoading
  const error = catalog.error ?? attempts.error ?? refreshError
  const unfinished = attempts.data.items.filter(item => item.status === 'active' || item.status === 'ready')
  const unfinishedWords = wordReviews.data.items.filter(item => item.status === 'active' || item.status === 'collecting')
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
  return <PageShell title="考一考 · KET" tone="paper" width="narrow">
    <Flex direction="column" gap="5">
      <Flex gap="3" wrap="wrap"><Button size="3" asChild><Link href="/exams/ket/practice">专项练习</Link></Button>
        <Button size="3" variant="soft" asChild><Link href="/exams/reports">学习报告与复盘</Link></Button>
        <Button size="3" variant="soft" loading={refreshing} onClick={async () => {
          if (!user) return
          setRefreshing(true); setRefreshError(null)
          try { await Promise.all([examCatalogStore.refreshInBackground(user.id), attemptListStore.refreshInBackground(user.id), wordReviewListStore.refreshInBackground(user.id)]) }
          catch (failure) { setRefreshError(failure) }
          finally { setRefreshing(false) }
        }}>刷新</Button></Flex>
      {error ? <StickerCard tone="danger" elevation="flat"><Text role="alert">{examErrorMessage(error)}</Text></StickerCard> : null}
      {wordReviews.error ? <StickerCard tone="danger" elevation="flat"><Text role="alert">暂时无法读取词汇补练任务，请刷新重试。</Text></StickerCard> : null}
      <div className="relative flex min-h-[calc(100dvh-15rem)] flex-col gap-5">
        <LoadingOverlay appearance="quiet" visible={loading} placement="content" />
        {!loading && !error && <>
          {unfinished.length > 0 && <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Text weight="bold" size="4">继续上次学习</Text>
            {unfinished.map(item => <Flex key={item.id} gap="3" align="center" justify="between"><Text>{item.title}</Text><Button size="3" variant="soft" asChild><Link href={`/exams/attempts/${item.id}`}>继续</Link></Button></Flex>)}
          </Flex></StickerCard>}
          {!wordReviews.error && unfinishedWords.length > 0 && <StickerCard as="section" size="lg"><Flex direction="column" gap="3"><Text weight="bold" size="4">继续词汇补练</Text>
            {unfinishedWords.map(item => <Flex key={item.id} gap="3" align="center" justify="between" wrap="wrap"><Flex direction="column" gap="1">
              <Text>{item.count} 个词条 · {item.status === 'active' ? '补练进行中' : '已确认待补练'}</Text>
              <Text size="2" color="gray">{new Date(item.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</Text>
            </Flex><Button size="3" variant="soft" asChild><Link href={`/exams/review-words/${encodeURIComponent(item.id)}`}>{item.status === 'active' ? '继续补练' : '打开待补练词'}</Link></Button></Flex>)}
            {wordReviews.data.items.length === 50 && <Text size="2" color="gray">任务来自最近 50 个补练批次。</Text>}
          </Flex></StickerCard>}
          {catalog.data.items.length === 0 && <StickerCard size="lg"><Text as="p">试卷正在准备中。审核并发布后，这里会显示可以开始的内容。</Text></StickerCard>}
          {catalog.data.items.filter(item => item.kind !== 'training_unit').map(item => <StickerCard key={item.revisionId} as="article" size="lg"><Flex direction="column" gap="3">
            <Flex gap="3" wrap="wrap"><Text size="4" weight="bold">{item.title}</Text><Badge variant="soft" radius="full">{item.purpose === 'reserved' ? '保留测评' : '日常训练'}</Badge></Flex>
            <Text as="p" size="2" color="gray">每科目明确开始后计时，提交后查看解答。开始前会检查所需资源。</Text>
            <StartExamButton revisionId={item.revisionId} mode="mock" />
            {item.purpose === 'training' && <Flex direction="column" gap="2"><Flex><Button size="3" variant="soft" asChild>
              <Link href={`/exams/ket/practice?revisionId=${encodeURIComponent(item.revisionId)}`}>按卷逐组练习</Link>
            </Button></Flex><Text as="p" size="2" color="gray">不限时，选择完整题组逐组开始、逐组提交。</Text></Flex>}
          </Flex></StickerCard>)}
          {catalog.data.hasMore && <Text size="2" color="gray">当前显示最近 100 个内容版本。</Text>}
        </>}
      </div>
    </Flex>
  </PageShell>
}
