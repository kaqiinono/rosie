'use client'

import { useState, type ComponentProps } from 'react'
import { FormSelect, SentenceHighlightText, StickerCard } from '@rosie/ui'
import { Checkbox, Flex, Heading, Text } from '@rosie/ui/themes'
import sports from './assets/sports-profiles.png'
import books from './assets/book-profiles.png'
import isabella from './assets/isabella-reading.png'
import { ILLUSTRATED_READING_SAMPLES } from './illustrated-reading-samples'

const images = { sports, books, isabella }

function Portrait({ source, viewBox, alt, missing }: {
  source: typeof sports; viewBox: string; alt: string; missing: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [, , width, height] = viewBox.split(' ').map(Number)
  return <figure className="m-0 w-48 max-w-full justify-self-center">
    <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
      {missing || failed
        ? <StickerCard tone="paper" elevation="flat" size="sm" className="flex h-full items-center justify-center">
          <Flex direction="column" gap="2" align="center">
            <Text size="2" weight="bold">图片位置保留</Text>
            <Text size="2" align="center" lang="en">{alt}</Text>
          </Flex>
        </StickerCard>
        : <svg role="img" aria-label={alt} viewBox={viewBox} className="block h-full w-full" preserveAspectRatio="xMidYMid meet">
          <image href={source.src} width={source.width} height={source.height} onError={() => setFailed(true)} />
        </svg>}
    </div>
  </figure>
}

/** Material layout experiment only; no attempt, scoring, database or media writes. */
export default function IllustratedReadingPreview() {
  const [sampleId, setSampleId] = useState('sports')
  const [missing, setMissing] = useState(false)
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({})
  const sample = ILLUSTRATED_READING_SAMPLES.find(item => item.id === sampleId) ?? ILLUSTRATED_READING_SAMPLES[0]
  const passage = (id: string, content: { text: string; sentences: readonly { id: string; start: number; end: number }[] },
    renderLayout?: ComponentProps<typeof SentenceHighlightText>['renderLayout']) => {
    const key = `${sample.id}/${id}`
    return <SentenceHighlightText key={key} text={content.text} sentences={content.sentences}
      selected={annotations[key] ?? []} renderLayout={renderLayout}
      onValueChange={selected => setAnnotations(previous => ({ ...previous, [key]: selected }))} />
  }
  return <Flex direction="column" gap="4">
    <FormSelect ariaLabel="图文材料样例" value={sample.id} onValueChange={setSampleId}
      options={ILLUSTRATED_READING_SAMPLES.map(item => ({ value: item.id, label: item.label }))} />
    <Text as="label" size="2">
      <Checkbox checked={missing} onCheckedChange={value => setMissing(value === true)} /> 模拟图片未绑定
    </Text>
    <Text size="2" color="gray">{sample.source} · 材料布局预览</Text>
    <StickerCard tone="paper" elevation="flat" size="md" className="@container">
      <Flex direction="column" gap="6">
        <Heading as="h3" size="5" lang="en">{sample.title}</Heading>
        {sample.rows.map(row => <section key={`${sample.id}/${row.id}`} aria-label={row.heading || sample.title}>
          {passage(row.id, row, ({ content, toolbar }) => <>
            <Flex align="center" justify={row.heading ? 'between' : 'end'} gap="3" mb="3">
              {row.heading && <Heading as="h4" size="4" lang="en">{row.heading}</Heading>}
              {toolbar}
            </Flex>
            <div className={row.side === 'left'
              ? 'grid items-center gap-5 @[36rem]:grid-cols-[12rem_minmax(0,1fr)]'
              : 'grid items-center gap-5 @[36rem]:grid-cols-[minmax(0,1fr)_12rem]'}>
              <div className={row.side === 'right' ? 'flex justify-center @[36rem]:order-2' : 'flex justify-center'}>
                <Portrait source={images[sample.image]} viewBox={row.viewBox} alt={row.alt} missing={missing} />
              </div>
              <div className="min-w-0">{content}</div>
            </div>
          </>)}
        </section>)}
        {'continuation' in sample && passage('continuation', sample.continuation)}
      </Flex>
    </StickerCard>
    <Text size="2" color="gray">宽屏图文并排，窄屏按人物分组。点击句尾的小笔可标记重点；刷新清空。</Text>
  </Flex>
}
