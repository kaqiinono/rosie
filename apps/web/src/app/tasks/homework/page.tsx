'use client'

import { useMemo, useState } from 'react'
import { englishWeeklyPlansStore } from '@rosie/english/hooks/useWeeklyPlan'
import { HomeworkPage, useHomeworkData, type Homework } from '@rosie/tasks'
import { Flex, Text } from '@rosie/ui/themes'

import HomeworkJournal from '@/components/time-tree/HomeworkJournal'
import HomeworkCardPreview from '@/components/time-tree/HomeworkCardPreview'
import { homeworkCardSummary } from '@/components/time-tree/homeworkCardSummary'
import { useTimeTree, useTreeHistory } from '@/components/time-tree/useTimeTree'
import { isDailyEnglishPlanPath } from '@/components/time-tree/weeklyPlanPractice'
import { homeworkCardWindow, previewHomeworkCard } from '@/lib/time-tree/practicePreview'
import { shift } from '@/lib/time-tree/types'

export default function Page() {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const { data: homework, user } = useHomeworkData()
  const scene = useTimeTree()
  const history = useMemo(() => {
    const tree = scene.tree
    const cards = new Set<string>()
    const dates = new Set<string>()
    if (tree) {
      const since = shift(tree.today, -6)
      for (const item of homework) {
        if (!item.practice_binding) continue
        const window = homeworkCardWindow(tree, item)
        if (!window || window.start >= since || tree.steps.some(step => step.occurrence === window.occurrence)) continue
        cards.add(item.id)
        for (let day = window.start; day < since; day = shift(day, 1)) dates.add(day)
      }
    }
    return { cards, days: [...dates] }
  }, [scene.tree, homework])
  const api = useTreeHistory(scene, history.days)
  const hasWordPlan = homework.some(item => {
    const path = item.practice_binding?.path
    return isDailyEnglishPlanPath(path) || path?.startsWith('/english/words/weekly/')
  })
  const wordPlans = englishWeeklyPlansStore.useSessionData(hasWordPlan ? user : null)
  const plans = hasWordPlan && !wordPlans.isLoading && !wordPlans.error ? wordPlans.data : undefined
  const cards = useMemo(() => {
    return new Map(homework.map(item => {
      const tree = history.cards.has(item.id) ? api.tree : scene.tree
      const current = tree ? previewHomeworkCard(tree, item) : null
      const summary = current ? homeworkCardSummary(current.content, current.date, plans) : null
      return [item.id, { current, summary, hasTree: !!tree }] as const
    }))
  }, [api.tree, history.cards, homework, plans, scene.tree])
  const preview = homework.find(item => item.id === previewId)
  const selected = preview ? cards.get(preview.id) : undefined
  const previewApi = preview && history.cards.has(preview.id) ? api : scene

  function renderPracticeSummary(item: Homework) {
    if (!item.enabled || !item.practice_binding || item.subject === 'life') return null
    const { current, summary, hasTree } = cards.get(item.id) ?? {}
    const loading = history.cards.has(item.id) ? api.isLoading : scene.isLoading
    const status = !hasTree ? (loading ? '正在读取…' : '暂时无法读取') : !current ? '本期暂无排期'
      : current.blocked ? '等待上次作业完成' : current.content?.exhausted ? '已到清单末尾' : !summary ? '暂无练习内容' : null
    return <Flex direction="column" gap="1" minWidth="0">
      <Text as="p" size="2" weight="bold">本期内容{!status && summary && summary.itemCount > 1 ? ` · 共 ${summary.itemCount} 项` : ''}</Text>
      {status ? <Text as="p" size="2" color="gray">{status}</Text> : <>
        {summary?.labels.slice(0, 2).map((label, index) =>
          <Text as="p" key={`${label}-${index}`} size="2" className="line-clamp-2 wrap-anywhere">{label}</Text>)}
        {summary?.wordGroups.map(({ scope, words }) => <Flex key={scope} direction="column" minWidth="0">
          <Text as="p" size="2" weight="bold" className="wrap-anywhere">{scope || '单词'}</Text>
          {!!words.length && <Text as="p" size="2" color="gray" className="wrap-anywhere">
            {words.slice(0, 3).join('、')}{words.length > 3 ? ` 等 ${words.length} 个词` : ''}
          </Text>}
        </Flex>)}
      </>}
    </Flex>
  }

  return (
    <HomeworkPage onPreview={item => setPreviewId(item.id)} renderPracticeSummary={renderPracticeSummary}>
      <HomeworkJournal />
      {preview && <HomeworkCardPreview key={preview.id} homework={preview} current={selected?.current ?? null}
        wordGroups={selected?.summary?.wordGroups} loading={!selected?.hasTree && previewApi.isLoading}
        error={!selected?.hasTree && !previewApi.isLoading ? previewApi.message || '暂时无法读取本期内容。' : undefined}
        onRetry={previewApi.retry} onClose={() => setPreviewId(null)} />}
    </HomeworkPage>
  )
}
