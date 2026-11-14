'use client'

import { Badge, Flex, Text } from '@rosie/ui/themes'
import type { PracticeContentBlock, PracticeEntryRow, PracticeResource } from '@rosie/tasks'

function tone(title: string): 'orange' | 'green' | 'gray' {
  if (title === '会写字' || title.includes('需背诵')) return 'orange'
  if (title === '会认字') return 'green'
  return 'gray'
}

function mediaColor(type: PracticeResource['type']): 'amber' | 'blue' | 'gray' {
  if (type === 'video') return 'amber'
  if (type === 'audio') return 'blue'
  return 'gray'
}

export function lessonResources(row: PracticeEntryRow): PracticeContentBlock[] {
  return (row.content ?? []).filter((block) => block.title)
}

export default function LessonResourceTags({ row }: { row: PracticeEntryRow }) {
  const blocks = lessonResources(row)
  if (!blocks.length) return null
  return <Flex gap="2" wrap="wrap" aria-label="本课资源">
    {blocks.map((block, index) => <Badge key={`${block.title}:${index}`} variant="soft" radius="full" color={tone(block.title)}>{block.title}</Badge>)}
  </Flex>
}

export function groupSelectionLessons(rows: PracticeEntryRow[]): { id: string; label: string; rows: PracticeEntryRow[] }[] {
  const groups: { id: string; label: string; rows: PracticeEntryRow[] }[] = []
  const index = new Map<string, number>()
  for (const row of rows) {
    const course = row.selectionPath?.find((part) => part.level === '课程')
    const unit = row.selectionPath?.find((part) => part.level === '单元')
    const id = row.values.key || row.values.lessonKey || row.values.poemId || row.id
    const label = course && unit && !course.label.includes(unit.label) ? `${unit.label} · ${course.label}` : course?.label || row.label
    const found = index.get(id)
    if (found === undefined) {
      index.set(id, groups.length)
      groups.push({ id, label, rows: [row] })
    } else groups[found].rows.push(row)
  }
  return groups
}

export function LessonResourceLine({ rows }: { rows: PracticeEntryRow[] }) {
  const media: PracticeResource[] = []
  const seenMedia = new Set<string>()
  for (const row of rows) for (const resource of row.resources ?? []) {
    if (seenMedia.has(resource.label)) continue
    seenMedia.add(resource.label)
    media.push(resource)
  }
  const chinese = rows.some((row) => row.values.bookSlug || row.values.contentType === 'chinese-course')
  const plan = rows.some((row) => row.values.contentType === 'english-plan')
  if (chinese) {
    const seen = new Set<string>()
    const content = rows.flatMap((row) => row.content ?? []).filter((block) => {
      if (!block.title || seen.has(block.title)) return false
      seen.add(block.title)
      return true
    })
    if (!content.length && !media.length) return <Text size="2" color="gray">暂无关联资源</Text>
    return <Flex direction="column" gap="2">
      {!!content.length && <LessonResourceTags row={{ ...rows[0], content }} />}
      {!!media.length && <Flex gap="2" wrap="wrap" aria-label="已关联资源">{media.map((resource) => <Badge key={resource.label} variant="soft" radius="full" color={mediaColor(resource.type)}>{resource.label}</Badge>)}</Flex>}
    </Flex>
  }
  if (plan) {
    const seen = new Set<string>()
    const content = rows.flatMap((row) => row.content ?? []).filter((block) => {
      if (!block.title || seen.has(block.title)) return false
      seen.add(block.title)
      return true
    })
    return content.length ? <LessonResourceTags row={{ ...rows[0], content }} /> : null
  }
  const sentences = rows.filter((row) => row.values.sentenceId).length
  const passage = rows.some((row) => !row.values.sentenceId && Boolean(row.values.key))
  if (!sentences && !passage && !media.length) return <Text size="2" color="gray">暂无关联资源</Text>
  return <Flex gap="2" wrap="wrap" aria-label="本课资源">
    {passage && <Badge variant="soft" radius="full" color="green">课文</Badge>}
    {sentences > 0 && <Badge variant="soft" radius="full" color="blue">{sentences} 句</Badge>}
    {media.map((resource) => <Badge key={resource.label} variant="soft" radius="full" color={mediaColor(resource.type)}>{resource.label}</Badge>)}
  </Flex>
}

export function SelectionLessonList({ rows }: { rows: PracticeEntryRow[] }) {
  const groups = groupSelectionLessons(rows)
  if (!groups.length) return null
  return <Flex direction="column" gap="3" aria-label="课文清单">
    {groups.map((group, index) => <Flex key={group.id} direction="column" gap="2">
      <Text size="2" weight="bold">{index + 1}. {group.label}</Text>
      <LessonResourceLine rows={group.rows} />
    </Flex>)}
  </Flex>
}
