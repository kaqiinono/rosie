'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@rosie/core'
import { ExamWordReviewCard } from '@rosie/english'
import { ExamVocabularyLinks, examWordLinksStore, wordReviewListStore, saveWordReview, wordReviewError } from '@rosie/exams'
import type { ExamResolvedWord, ExamWordReviewBatch, VocabularyLink } from '@rosie/exams'
import { StickerCard } from '@rosie/ui'
import { Button, Flex, Spinner, Text } from '@rosie/ui/themes'

type Pending = { path: string; body: Record<string, unknown>; start: boolean }
type Props = { attemptId: string; links: readonly VocabularyLink[] }
export function ExamVocabularyReviewBridge(props: Props) {
  const { user } = useAuth()
  return user ? <VocabularyReviewContent key={user.id} {...props} /> : null
}
function VocabularyReviewContent({ attemptId, links }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const store = useMemo(() => examWordLinksStore(attemptId), [attemptId])
  const { data, isLoading, error: loadError } = store.useSessionData(user)
  const list = wordReviewListStore.useSessionData(user)
  const [card, setCard] = useState<ExamResolvedWord | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [latest, setLatest] = useState<ExamWordReviewBatch | null>(null)
  const [message, setMessage] = useState('')
  const collecting = latest?.status === 'collecting' ? latest : list.data.items.find(item => item.status === 'collecting')
  const run = async (command: Pending) => {
    if (!user || lock.current) return
    lock.current = true; setBusy(true); setError(null); setPending(command)
    try {
      const batch = await saveWordReview(user.id, command.path, command.body)
      setLatest(batch); setPending(null)
      if (command.start) router.push(`/exams/review-words/${batch.id}`)
      else setMessage(`已加入词汇补练，共 ${batch.items.length} 词。重复词保留多个来源。`)
    } catch (cause) { setError(cause) }
    finally { lock.current = false; setBusy(false) }
  }
  const refresh = async () => {
    if (!user || lock.current) return
    lock.current = true; setBusy(true)
    try { await Promise.all([store.refreshInBackground(user.id), wordReviewListStore.refreshInBackground(user.id)]); setLatest(null); setPending(null); setError(null) }
    catch (cause) { setError(cause) }
    finally { lock.current = false; setBusy(false) }
  }
  const available = new Set(links.map(link => link.id))
  return <Flex direction="column" gap="3">
    {(isLoading || list.isLoading) && <Flex role="status" gap="2" align="center"><Spinner /><Text>正在读取关联词条…</Text></Flex>}
    {(error || loadError || list.error) != null && <StickerCard tone="warning"><Flex direction="column" gap="3"><Text role="alert">{wordReviewError(error || loadError || list.error)}</Text>
      <Flex gap="2" wrap="wrap">{pending && <Button size="3" loading={busy} onClick={() => void run(pending)}>重试保存</Button>}
        <Button size="3" variant="soft" disabled={busy} onClick={() => void refresh()}>重新读取</Button></Flex></Flex></StickerCard>}
    {!isLoading && !loadError && <ExamVocabularyLinks items={data.items.filter(item => available.has(item.link.id))} busy={busy || !!pending || list.isLoading} pendingCount={collecting ? 'items' in collecting ? collecting.items.length : collecting.count : 0} hasPendingBatch={!!collecting}
      bridge={{ openWord: setCard,
        addWord: item => run({ path: '/api/exams/word-review', body: { requestId: crypto.randomUUID(), attemptId, linkId: item.link.id }, start: false }),
        startReview: () => collecting ? run({ path: `/api/exams/word-review/${collecting.id}`, body: { requestId: crypto.randomUUID(), expectedVersion: collecting.version, operation: 'start' }, start: true }) : Promise.resolve(),
      }} />}
    {collecting && <Button asChild variant="soft" size="3"><Link href={`/exams/review-words/${collecting.id}`}>查看待补练词</Link></Button>}
    {message && <Text size="2" role="status">{message}</Text>}
    <ExamWordReviewCard word={card?.word ?? null} mastery={card?.mastery ?? undefined} source={card?.sources[0]} onClose={() => setCard(null)} />
  </Flex>
}
