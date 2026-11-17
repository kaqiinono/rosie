'use client'

import { useState, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import PassageView from '@rosie/english/components/reading/PassageView'
import { findPassageByKey, type ReadingPassage } from '@rosie/english/utils/reading-data'
import { AppDialog, LearningIcon, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import { ResourcePlayer } from './ResourcePlayer'
import SentenceRowPreview from '../task-entries/SentenceRowPreview'
import ReadingPreviewDrawer from '../task-entries/ReadingPreviewDrawer'
import { resourceHref, type PracticeEntryRow, type PracticeResource } from '@rosie/tasks'

export default function PracticeResources({ row, detailPassage, actions }: {
  row: PracticeEntryRow
  detailPassage?: ReadingPassage
  actions?: ReactNode
}) {
  const router = useRouter()
  const [readingOpen, setReadingOpen] = useState(false)
  const [active, setActive] = useState<PracticeResource | null>(null)
  const [error, setError] = useState('')
  const resources = row.resources ?? []
  const passage = !row.values.sentenceId && row.values.key ? findPassageByKey(row.values.key) : undefined
  const fullPassage = passage ?? detailPassage
  const [narrationRef, setNarrationRef] = useState<RefObject<HTMLVideoElement | null> | undefined>(undefined)
  const isNarration = active?.id === `audio:${passage?.key}:narration`
  if (row.values.sentenceId) return <SentenceRowPreview key={row.id} row={row} />
  return <Flex direction="column" gap="3">
    {row.values.requiresRecite === 'true' && <Flex><Badge color="orange">需背诵</Badge></Flex>}
    {row.values.contentType === 'chinese-course' && row.values.requiresRecite === 'unknown' && <Text size="1" color="gray">背诵要求待补充</Text>}
    {passage && <PassageView passage={passage} lessonWords={[]} masteryMap={{}} mode="focus" narrationRef={isNarration ? narrationRef : undefined} />}
    {(passage ? [] : row.content ?? []).filter((block) => block.text.trim() || block.translation?.trim()).map((block, index) => <StickerCard key={index} size="sm" tone="paper">
      <Flex direction="column" gap="2">
        {block.title && <Text size="3" weight="bold">{block.title}</Text>}
        {row.values.contentType === 'chinese-course' && ['会认字', '会写字', '词语', '读一读，记一记'].includes(block.title) ?
          <Flex gap="2" wrap="wrap">{block.text.split('　').filter(Boolean).map((text, i) => <Badge key={`${text}:${i}`} size="3" color={block.title === '会写字' ? 'orange' : 'green'}>{text}</Badge>)}</Flex> :
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{block.text}</p>}
        {block.translation && <p className="whitespace-pre-wrap break-words text-sm text-text-secondary">{block.translation}</p>}
      </Flex>
    </StickerCard>)}
    <Flex gap="2" wrap="wrap">
      {resources.map((resource) => <Button key={resource.id} variant="soft" aria-label={`${resource.type === 'link' ? '打开' : '播放'}${resource.label}`} onClick={() => {
        setError('')
        try {
          const href = resourceHref(resource.url)
          if (resource.type === 'link') { setActive(null); router.push(href) }
          else setActive((current) => current?.id === resource.id ? null : resource)
        } catch { setError('资源链接无效，请在作业内容管理中修改。') }
      }}>{resource.type === 'audio' ? <LearningIcon name="readAloud" /> : <span aria-hidden>{resource.type === 'video' ? '🎬' : '🔗'}</span>}{resource.label}</Button>)}
      {fullPassage && <Button variant="soft" onClick={() => { setActive(null); setReadingOpen(true) }}>
        {detailPassage ? '进入详情页' : '查看全文'}
      </Button>}
      {actions}
    </Flex>
    {row.resourceStatus === 'error' && <Text size="2" color="gray">{row.resourceError || '部分资源尚未读取成功，可在作业内容管理中刷新关联资源。'}</Text>}
    {error && <Text role="alert" color="red">{error}</Text>}
    {fullPassage && <ReadingPreviewDrawer passageKey={fullPassage.key} open={readingOpen} onClose={() => setReadingOpen(false)} />}
    {active?.type === 'audio' && <ResourcePlayer key={active.id} resource={active} close={() => setActive(null)} onMediaReady={setNarrationRef} />}
    <AppDialog open={active?.type === 'video'} title={active?.label ?? '视频回放'} size="preview" onOpenChange={(open) => { if (!open) setActive(null) }}>
      {active?.type === 'video' && <ResourcePlayer key={active.id} resource={active} close={() => setActive(null)} onMediaReady={setNarrationRef} />}
    </AppDialog>
  </Flex>
}
