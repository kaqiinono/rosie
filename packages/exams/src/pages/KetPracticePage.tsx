'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@rosie/core'
import { FormSelect, LoadingOverlay, PageShell, StickerCard } from '@rosie/ui'
import { Badge, Button, Checkbox, Flex, Text } from '@rosie/ui/themes'
import { practiceCatalogStore } from '../client/learningCatalog'
import { examErrorMessage } from '../client/examApi'
import { StartExamButton } from '../components/StartExamButton'
import type { ExamPracticeOptions } from '../types/catalog'

type FilterKey = 'revisionId' | 'sectionId' | 'partNumber' | 'domain' | 'questionType' | 'knowledgePoint' | 'wordEntryId'
type Filters = Record<FilterKey, string>
const EMPTY_FILTERS: Filters = { revisionId: '', sectionId: '', partNumber: '', domain: '', questionType: '', knowledgePoint: '', wordEntryId: '' }
const FIELDS: { key: FilterKey; options: keyof ExamPracticeOptions; label: string; all: string }[] = [
  { key: 'revisionId', options: 'revisions', label: '试卷', all: '全部训练试卷' },
  { key: 'sectionId', options: 'sections', label: '科目', all: '全部科目' },
  { key: 'partNumber', options: 'parts', label: 'Part', all: '全部 Part' },
  { key: 'domain', options: 'domains', label: '能力领域', all: '全部能力' },
  { key: 'questionType', options: 'questionTypes', label: '题型', all: '全部题型' },
  { key: 'knowledgePoint', options: 'knowledgePoints', label: '考点', all: '全部考点' },
  { key: 'wordEntryId', options: 'words', label: '关联词', all: '全部关联词' },
]

export function KetPracticePage({ wordReviewBatchId, revisionId }: { wordReviewBatchId?: string; revisionId?: string } = {}) {
  const { user } = useAuth()
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, revisionId: revisionId ?? '' }))
  const [unseen, setUnseen] = useState(false)
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const query = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), unseen: String(unseen) })
    for (const [key, selected] of Object.entries(filters)) if (selected) value.set(key, selected)
    if (wordReviewBatchId) value.set('wordReviewBatchId', wordReviewBatchId)
    return value.toString()
  }, [filters, unseen, page, wordReviewBatchId])
  const store = useMemo(() => practiceCatalogStore(query), [query])
  const { data, isLoading, error } = store.useSessionData(user)
  const hasFilters = unseen || Object.values(filters).some(Boolean)
  const setFilter = (key: FilterKey, value: string) => {
    setFilters(previous => {
      const next = { ...previous, [key]: value }
      const index = FIELDS.findIndex(field => field.key === key)
      for (const field of FIELDS.slice(index + 1)) next[field.key] = ''
      return next
    })
    setPage(1)
  }
  return <PageShell title="KET 专项练习" tone="paper" width="narrow" showAccount><Flex direction="column" gap="5">
    <StickerCard as="section"><Flex direction="column" gap="4">
      <Text as="p">先选试卷，再挑科目、Part 或考点。练习不限时，每次开始一个完整题组，逐组提交后查看解答。</Text>
      {wordReviewBatchId && <Text as="p" size="2">本页只显示与这次补练词有关、尚未见过材料的训练题组。</Text>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map(field => {
          const available = data.options[field.options]
          const selected = filters[field.key]
          const options = [{ value: '', label: field.all }, ...available]
          if (selected && !available.some(option => option.value === selected)) options.push({ value: selected, label: isLoading ? '正在读取所选条件…' : '所选条件暂不可用' })
          return <Flex key={field.key} direction="column" gap="2">
            <Text size="2" weight="medium">{field.label}</Text>
            <FormSelect size="3" ariaLabel={field.label} value={selected} options={options} disabled={isLoading || refreshing}
              onValueChange={value => setFilter(field.key, value)} />
          </Flex>
        })}
      </div>
      <Flex gap="3" align="center" wrap="wrap" justify="between">
        <Text as="label" size="3"><Flex gap="2" align="center"><Checkbox checked={unseen || !!wordReviewBatchId} disabled={isLoading || !!wordReviewBatchId}
          onCheckedChange={value => { setUnseen(value === true); setPage(1) }} />只看未见材料</Flex></Text>
        <Button size="3" variant="soft" disabled={!hasFilters || isLoading} onClick={() => { setFilters({ ...EMPTY_FILTERS }); setUnseen(false); setPage(1) }}>清除筛选</Button>
      </Flex>
      {!isLoading && data.optionsLimited && <Text as="p" size="2" color="gray">可选标签较多，先选定试卷或科目，可查看更完整的选项。</Text>}
    </Flex></StickerCard>
    {error != null && <StickerCard tone="danger" elevation="flat"><Flex direction="column" gap="3"><Text role="alert">{examErrorMessage(error)}</Text>
      <Button size="3" variant="soft" loading={refreshing} onClick={async () => { if (!user) return; setRefreshing(true); try { await store.refreshInBackground(user.id) } catch { /* store owns the error */ } finally { setRefreshing(false) } }}>重试</Button>
    </Flex></StickerCard>}
    <div className="relative flex min-h-[calc(100dvh-24rem)] flex-col gap-4"><LoadingOverlay visible={isLoading || refreshing} placement="content" appearance="quiet" />
      {!isLoading && !error && !data.items.length && <StickerCard size="lg"><Text as="p">当前没有符合条件的已发布训练题组。可清除部分筛选，或等待新增内容。</Text></StickerCard>}
      {!isLoading && !error && data.items.map(group => <StickerCard key={`${group.revisionId}:${group.groupId}`} as="article" size="lg"><Flex direction="column" gap="3">
        <Text size="4" weight="bold">{group.title}</Text>
        <Text size="3" weight="medium">{group.sectionLabel} · {group.partLabel}</Text>
        <Flex gap="2" wrap="wrap"><Badge variant="soft" radius="full">{group.seen ? '已见材料' : '未见材料'}</Badge><Badge variant="soft" radius="full">{group.role === 'training' ? '教学训练' : '真题题组'}</Badge>
          {group.questionTypeLabels.map((label, index) => <Badge key={group.questionTypes[index]} variant="soft" radius="full">{label}</Badge>)}</Flex>
        <Text as="p">本组共 {group.questionCount} 题，其中 {group.matchedQuestionCount} 题符合当前条件。开始后会保留整组题目和共享材料。</Text>
        {group.knowledgePoints.length > 0 && <Text size="2" color="gray">考点：{group.knowledgePoints.join(' · ')}</Text>}
        <StartExamButton revisionId={group.revisionId} groupId={group.groupId} mode="practice" wordReviewBatchId={wordReviewBatchId} />
      </Flex></StickerCard>)}
    </div>
    <Flex justify="between" align="center"><Button size="3" variant="soft" disabled={page === 1 || isLoading || refreshing} onClick={() => setPage(value => value - 1)}>上一页</Button><Text size="2">第 {page} 页</Text>
      <Button size="3" variant="soft" disabled={!data.hasMore || isLoading || refreshing || !!error} onClick={() => setPage(value => value + 1)}>下一页</Button></Flex>
    {data.catalogLimited && <Text size="2" color="gray">通用目录显示前 100 个已发布训练版本；按试卷链接仍可打开指定的可练习试卷。</Text>}
  </Flex></PageShell>
}
