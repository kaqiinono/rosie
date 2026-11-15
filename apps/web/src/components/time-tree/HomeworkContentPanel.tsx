'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { entryHref, type PracticeEntryRow } from '@rosie/tasks'
import { LoadingOverlay, StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Text } from '@rosie/ui/themes'
import PracticeResources from './PracticeResources'

const MathPracticeContent = dynamic(() => import('./MathPracticeContent'), { loading: () => <Flex direction="column" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })
const EmbeddedCalcStartPanel = dynamic(() => import('@rosie/calc/components/EmbeddedCalcStartPanel'), { loading: () => <Flex direction="column" minHeight="256px"><LoadingOverlay visible placement="content" /></Flex> })

type Props = {
  name?: string
  row?: PracticeEntryRow | null
  href?: string | null
  items?: { row: PracticeEntryRow; href: string }[]
  exhausted?: boolean
  loading?: boolean
  error?: string
  disabled?: boolean
  onRetry?: () => void
}

/** Render each frozen item with its own content and destination. */
function PracticeItemContent({ row, href, disabled }: Pick<Props, 'row' | 'href' | 'disabled'>) {
  const router = useRouter()
  const calc = Boolean(href && /^\/calc(?:[/?#]|$)/.test(href))
  const adaptive = Boolean(href && /^\/english\/words\/adaptive\/[^/?#]+\/practice\/?(?:[?#]|$)/.test(href))
  const math = Boolean(row?.values.problemId && (row.values.contentType === 'math-question' || href?.startsWith('/math/')))
  const detailButton = href && !calc ? <Button variant="soft" disabled={disabled} onClick={() => router.push(entryHref(href, {}))}>进入详情页</Button> : null
  return <Flex direction="column" gap="3">
    {row?.label && <Text size="2" weight="bold">{row.label}</Text>}
    {calc ? <EmbeddedCalcStartPanel /> : row && (math ? <MathPracticeContent row={row} actions={detailButton} /> : <PracticeResources row={row} />)}
    {adaptive && <Text size="2">打开后直接进入这次自适应练习。</Text>}
    {!math && detailButton && <Flex gap="2" wrap="wrap" align="center">{detailButton}</Flex>}
  </Flex>
}

/** Shared by real bubble details and the real-content preview. No progress mutations. */
export default function HomeworkContentPanel({ name, row, href, items, exhausted = false, loading = false, error, disabled = false, onRetry }: Props) {
  const entries = items?.length ? items : [{ row, href }]
  return <section aria-label="作业内容">
    <StickerCard tone="paper" size="sm" elevation="flat" radius="md" className="w-full">
      <Flex direction="column" gap="3">
        <Heading as="h3" size="3">作业内容</Heading>
        {loading ? <Flex position="relative" minHeight="160px"><LoadingOverlay visible placement="content" /></Flex> : error ? <Flex direction="column" gap="2">
          <Text role="alert" color="red">{error}</Text>
          {onRetry && <Button variant="soft" disabled={disabled} onClick={onRetry}>重试读取内容</Button>}
        </Flex> : <>
          {name && <Text size="2">{name}{entries.length > 1 ? ` · 共 ${entries.length} 项` : ''}</Text>}
          {exhausted ? <Text size="2">全部练习内容已完成，可以继续线下完成作业，或在作业设置中选择新的开始项。</Text> : entries.map((item, index) => (
            <Flex key={`${item.row?.id ?? 'entry'}:${index}`} direction="column" gap="2">
              {entries.length > 1 && <Text size="2" weight="bold">第 {index + 1} 项</Text>}
              <PracticeItemContent row={item.row} href={item.href} disabled={disabled} />
            </Flex>
          ))}
        </>}
      </Flex>
    </StickerCard>
  </section>
}
