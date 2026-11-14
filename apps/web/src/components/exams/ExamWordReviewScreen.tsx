'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { ExamWordReviewCard, ExamWordReviewSession } from '@rosie/english'
import { wordReviewBatchStore, saveWordReview, wordReviewError } from '@rosie/exams'
import type { ExamWordReviewItem } from '@rosie/exams'
import { LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'

type Pending = { body: Record<string, unknown>; showHelp: boolean }
export function ExamWordReviewScreen({ batchId }: { batchId: string }) {
  const { user } = useAuth()
  return user ? <WordReviewContent key={`${user.id}:${batchId}`} batchId={batchId} /> : null
}
function WordReviewContent({ batchId }: { batchId: string }) {
  const { user } = useAuth()
  const store = useMemo(() => wordReviewBatchStore(batchId), [batchId])
  const { data: batch, isLoading, error: loadError } = store.useSessionData(user)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [card, setCard] = useState<ExamWordReviewItem | null>(null)
  const run = async (command: Pending) => {
    if (!user || lock.current) return
    lock.current = true; setBusy(true); setError(null); setPending(command)
    try {
      const saved = await saveWordReview(user.id, `/api/exams/word-review/${encodeURIComponent(batchId)}`, command.body)
      setPending(null)
      if (command.showHelp) setCard(saved.items.find(item => item.wordEntryId === saved.current?.wordEntryId) ?? null)
    } catch (cause) { setError(cause) }
    finally { lock.current = false; setBusy(false) }
  }
  const action = (operation: string, answer?: string, wordEntryId?: string) => {
    if (!batch || pending) return
    void run({ body: { requestId: crypto.randomUUID(), expectedVersion: batch.version, operation, ...(answer === undefined ? {} : { answer }), ...(wordEntryId ? { wordEntryId } : {}) }, showHelp: operation === 'help' })
  }
  const refresh = async () => {
    if (!user || lock.current) return
    lock.current = true; setBusy(true)
    try { await store.refreshInBackground(user.id); setPending(null); setError(null); setCard(null) }
    catch (cause) { setError(cause) }
    finally { lock.current = false; setBusy(false) }
  }
  const current = batch?.current
  const word = batch?.items.find(item => item.wordEntryId === current?.wordEntryId)
  const invalid = batch?.items.some(item => !item.valid)
  const sources = batch?.items.flatMap(item => item.sources).filter((source, index, all) => all.findIndex(other => other.attemptId === source.attemptId) === index) ?? []
  return <PageShell title="词汇补练" subtitle="先选词义，再练拼写" tone="paper" width="narrow" backHref="/exams/ket">
    <div className="relative flex min-h-[calc(100dvh-12rem)] flex-col gap-5"><LoadingOverlay appearance="quiet" visible={isLoading} placement="content" />
      {(error || loadError) != null && <StickerCard tone="warning"><Flex direction="column" gap="3"><Text role="alert">{wordReviewError(error || loadError)}</Text>
        <Flex gap="2" wrap="wrap">{pending && <Button size="3" loading={busy} onClick={() => void run(pending)}>重试保存</Button>}
          <Button size="3" variant="soft" disabled={busy} onClick={() => void refresh()}>重新读取已保存进度</Button></Flex></Flex></StickerCard>}
      {batch && !isLoading && <>
        {invalid && batch.status !== 'completed' && <StickerCard tone="warning"><Text role="alert">有词条的来源已经失效，补练已停止。请返回来源复盘，重新核对词条。</Text></StickerCard>}
        {batch.status === 'collecting' && <StickerCard><Flex direction="column" gap="4"><Text size="5" weight="bold">这批共 {batch.items.length} 词</Text>
          <Flex direction="column" gap="2">{batch.items.map(item => <Flex key={item.wordEntryId} gap="2" align="center" justify="between"><Badge radius="full">{item.word.word}{item.valid ? '' : ' · 来源失效'}</Badge><Button size="2" variant="soft" disabled={busy || !!pending} onClick={() => action('remove', undefined, item.wordEntryId)}>移出这批</Button></Flex>)}</Flex>
          <Button size="3" loading={busy} disabled={invalid || !!pending || !batch.items.length} onClick={() => action('start')}>开始词汇补练</Button>
        </Flex></StickerCard>}
        {batch.status === 'active' && word && current && !invalid && <ExamWordReviewSession key={`${batch.id}:${batch.cursor}`} word={word.word} phase={current.phase} options={current.options} progress={word[current.phase]} position={batch.cursor + 1} total={batch.items.length * 2} busy={busy || !!pending}
          onAnswer={answer => action('answer', answer)} onHelp={() => action('help')} onRetry={() => action('retry')} onNext={() => action('next')} />}
        {batch.status === 'completed' && <StickerCard tone="success" size="lg"><Flex direction="column" gap="4"><Text size="5" weight="bold">补练已保存</Text>
          <Text>完成 {batch.items.length} 个词的词义与拼写练习。求助和重试也已记录。</Text>
          <Text size="2">词汇记忆与新题应用分别记录。本次尚待新题验证。</Text>
          {batch.next?.activePlanHref ? <Button asChild size="3" variant="soft"><Link href={batch.next.activePlanHref}>继续现有 KET 学习计划</Link></Button> : <Text size="2" color="gray">{batch.next?.planStatus === 'unavailable' ? '暂时无法读取现有 KET 学习计划，请稍后重新读取。' : '当前没有活动中的 KET 学习计划。可以继续完成其他补练。'}</Text>}
          {batch.next?.materialHref ? <Button asChild size="3"><Link href={batch.next.materialHref}>用新题验证</Link></Button> : <Text size="2" color="gray">等待新题验证</Text>}
        </Flex></StickerCard>}
        <StickerCard as="section"><Flex direction="column" gap="3"><Text weight="bold">回到来源复盘</Text>
          {sources.map(source => <Button key={source.attemptId} asChild variant="soft" size="3"><Link href={`/exams/attempts/${source.attemptId}/review`}>{source.title}</Link></Button>)}
        </Flex></StickerCard>
      </>}
    </div>
    <ExamWordReviewCard word={card?.word ?? null} source={card?.sources[0]} onClose={() => setCard(null)} />
  </PageShell>
}
