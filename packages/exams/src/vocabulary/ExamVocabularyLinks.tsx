'use client'

import { StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import type { ExamResolvedWord, ExamVocabularyBridge } from '../types/vocabulary'

type Props = { items: readonly ExamResolvedWord[]; bridge: ExamVocabularyBridge; busy: boolean; pendingCount: number; hasPendingBatch: boolean }
export function ExamVocabularyLinks({ items, bridge, busy, pendingCount, hasPendingBatch }: Props) {
  return <StickerCard as="section"><Flex direction="column" gap="4">
    <Text size="4" weight="bold">确认需要复习的词</Text>
    <Text size="2" color="gray">每批最多 10 词。词库掌握状态沿用原来的共享记录；本次补练单独记录。</Text>
    {!items.length && <Text>这部分暂时没有已审核的词条关联。</Text>}
    {items.map(item => <Flex key={item.link.id} justify="between" align="center" gap="3" wrap="wrap">
      <Flex direction="column" gap="1"><Text weight="bold">{item.link.sourceSnapshot.word}</Text>
        <Text size="2">{item.link.contextMeaning}</Text>
        <Text size="1" color="gray">{item.link.sourceSnapshot.stage} · {item.link.sourceSnapshot.unit} · {item.link.sourceSnapshot.lesson}</Text>
        {!item.valid && <Badge color="red">来源失效</Badge>}
      </Flex>
      <Flex gap="2" wrap="wrap"><Button size="3" variant="soft" disabled={busy || !item.valid} onClick={() => bridge.openWord(item)}>查看词卡</Button>
        <Button size="3" variant="soft" disabled={busy || !item.valid} onClick={() => void bridge.addWord(item)}>加入词汇补练</Button></Flex>
    </Flex>)}
    {hasPendingBatch && <Flex gap="3" align="center" wrap="wrap"><Badge radius="full">待补练 {pendingCount} / 10 词</Badge>
      <Button size="3" loading={busy} disabled={!pendingCount} onClick={() => void bridge.startReview()}>开始词汇补练</Button></Flex>}
  </Flex></StickerCard>
}
