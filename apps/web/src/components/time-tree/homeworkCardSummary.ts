import type { WeeklyPlan } from '@rosie/core'
import type { PracticeEntryRow } from '@rosie/tasks'
import type { PracticePreview } from '@/lib/time-tree/practicePreview'
import { isDailyEnglishPlanPath, weeklyPlanForDate, weeklyPlanPracticeTarget } from './weeklyPlanPractice'

type WordPlan = Pick<WeeklyPlan, 'id' | 'weekStart' | 'unit' | 'lesson' | 'days'>

function lessonScope(unit?: string, lesson?: string) {
  return [unit?.replace(/^(?:unit|u)\s*(\d+)$/i, 'Unit $1'), lesson?.replace(/^(?:lesson|l)\s*(\d+)$/i, 'Lesson $1')]
    .filter(Boolean).join(' · ')
}

function itemLabel(row: PracticeEntryRow): string {
  const sentence = row.values.sentenceId?.match(/^(\d+)-(\d+)$/)
  if (!sentence) return row.label
  const text = row.content?.find(block => block.title === '句子')?.text.trim()
  if (!text) return row.label
  const lesson = row.selectionPath?.find(part => part.level === '课程')?.label ??
    lessonScope(undefined, row.values.lesson)
  return [lessonScope(row.values.unit), lesson, `第 ${Number(sentence[1]) + 1} 段第 ${Number(sentence[2]) + 1} 句`, text]
    .filter(Boolean).join(' · ')
}

export function homeworkCardSummary(content: PracticePreview | null, date: string, plans?: WordPlan[]) {
  if (!content || content.exhausted) return null
  const items = content.items?.length ? content.items : [content]
  const labels: string[] = []
  const grouped = new Map<string, string[]>()
  function addWords(scope: string, words: string[]) {
    const group = grouped.get(scope) ?? []
    group.push(...words)
    grouped.set(scope, group)
  }
  for (const item of items) {
    const { row, href } = item
    if (!row && !href) continue
    const target = weeklyPlanPracticeTarget(item)
    const daily = isDailyEnglishPlanPath(href)
    const plan = target ? plans?.find(plan => plan.id === target.planId) : daily && plans ? weeklyPlanForDate(plans, date) : undefined
    const day = plan?.days.find(day => day.date === (target?.date ?? date))
    if (day?.newWordKeys.length) {
      for (const key of day.newWordKeys) {
        const [unit, lesson, ...word] = key.split('::')
        if (word.length) addWords(lessonScope(unit, lesson), [word.join('::')])
        else addWords(lessonScope(plan?.unit, plan?.lesson), [key])
      }
      continue
    }
    const words = row?.content?.filter(block => block.title === '单词')
      .flatMap(block => block.text.split(/[、\n]/).map(word => word.trim()).filter(Boolean)) ?? []
    const scope = lessonScope(row?.values.unit, row?.values.lesson) ||
      row?.selectionPath?.find(part => part.level === '计划')?.label || ''
    if (words.length) addWords(scope, words)
    else if (row?.values.word) addWords(scope, [row.values.word])
    else if (scope && (target || /^\/english\/words\/(?:cards|practice)(?:[/?#]|$)/.test(href ?? ''))) addWords(scope, [])
    else labels.push(row ? itemLabel(row) : daily && plans ? '这一天没有安排单词' : content.name)
  }
  const wordGroups = [...grouped].map(([scope, words]) => ({ scope, words: [...new Set(words)] }))
  return labels.length || wordGroups.length ? { itemCount: items.length, labels, wordGroups } : null
}
