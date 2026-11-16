'use client'

import { useState } from 'react'
import { ListeningClipText } from '@rosie/english'
import type { PracticeEntryRow } from '@rosie/tasks'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { ResourcePlayer } from '../time-tree/ResourcePlayer'
import ReadingPreviewDrawer from './ReadingPreviewDrawer'

export default function SentenceRowPreview({ row }: { row: PracticeEntryRow }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [replay, setReplay] = useState(0)
  const [loop, setLoop] = useState(false)
  const [readingOpen, setReadingOpen] = useState(false)
  const resources = (row.resources ?? []).filter((resource) => resource.type === 'audio')
  const resource = resources.find((item) => item.label === '句子听记') ?? resources.find((item) => item.label === '原文单句') ?? resources[0]
  const active = resource?.id === activeId ? resource : undefined
  const blocks = (row.content ?? []).filter((block) => block.text)

  return <Flex direction="column" gap="3" aria-label="单句听记预览">
    {row.values.requiresRecite === 'true' && <Flex><Badge color="orange">需背诵</Badge></Flex>}
    {blocks.map((block, index) => <div key={index} className="min-w-0 py-3">
      <ListeningClipText english={block.text} chinese={block.translation} />
    </div>)}
    {!blocks.length && <Text size="2" color="gray">这项没有可预览的正文。</Text>}
    <Flex gap="2" align="center" wrap="wrap">
      {resource && <>
      <Button color="orange"
        variant={activeId === resource.id ? 'solid' : 'soft'}
        aria-pressed={activeId === resource.id}
        onClick={() => { setActiveId(resource.id); setReplay((value) => value + 1) }}>
        {activeId === resource.id ? '重播' : '播放'}
      </Button>
      <Button color="orange" variant={loop ? 'solid' : 'soft'} aria-pressed={loop}
        onClick={() => setLoop((value) => !value)}>
        单曲循环{loop ? '：开' : '：关'}
      </Button>
      </>}
      {row.values.key && <Button variant="soft" onClick={() => { setActiveId(null); setReadingOpen(true) }}>查看全文</Button>}
    </Flex>
    {row.values.key && <>
      <ReadingPreviewDrawer passageKey={row.values.key} open={readingOpen} onClose={() => setReadingOpen(false)} />
    </>}
    {!resources.length && <Text size="2" color="gray">此句尚未绑定单句音频，可在绑定后刷新资源。</Text>}
    {row.resourceStatus === 'error' && <Text size="2" color="red" role="status">
      {row.resourceError || '部分音频读取失败，请刷新资源重试。'}
    </Text>}
    {active && <ResourcePlayer key={`${active.id}:${replay}`} resource={active} loop={loop} close={() => setActiveId(null)} />}
  </Flex>
}
