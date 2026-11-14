'use client'

import { Flex } from '@rosie/ui/themes'
import type { ExamDraftInput } from '../../validation/contracts'
import type { QuestionGroup } from '../../types/content'
import { ActivityBlocks, OptionFields } from './ExamActivityFields'
import { DraftText } from './DraftFields'
import { ImageSizeControl } from './ImageSizeControl'

export type SharedTarget = { key: string; label: string } & (
  | { kind: 'instruction'; blockId: string }
  | { kind: 'material'; materialId: string; blockId?: string }
  | { kind: 'pool'; poolId: string }
  | { kind: 'activity'; activityId: string; field: 'title' | 'wordBank' | 'choices' | 'image' }
)

export function sharedTargets(draft: ExamDraftInput, group: QuestionGroup): SharedTarget[] {
  return [
    ...(group.activities ?? []).flatMap(activity => {
      const targets: SharedTarget[] = [{ key: `${activity.id}/title`, label: `${activity.title || '活动'} · 标题`, kind: 'activity', activityId: activity.id, field: 'title' }]
      if (activity.wordBank) targets.push({ key: `${activity.id}/words`, label: '共用词库', kind: 'activity', activityId: activity.id, field: 'wordBank' })
      if (activity.choicePresentation) targets.push({ key: `${activity.id}/choices`, label: '共用作答选项', kind: 'activity', activityId: activity.id, field: 'choices' })
      if (activity.imageSlotId && !draft.content.materials.some(material => activity.materialIds.includes(material.id) && material.blocks.some(block => block.kind === 'image' && block.mediaSlotId === activity.imageSlotId))) targets.push({ key: `${activity.id}/image`, label: '活动插图', kind: 'activity', activityId: activity.id, field: 'image' })
      return targets
    }),
    ...group.instructions.map((block, i): SharedTarget => ({ key: `instruction/${block.id}`, label: `共用说明 ${i + 1}`, kind: 'instruction', blockId: block.id })),
    ...draft.content.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => [
      { key: `material/${material.id}`, label: `${material.title || '材料'} · 标题`, kind: 'material' as const, materialId: material.id },
      ...material.blocks.map((block, i): SharedTarget => ({ key: `material/${material.id}/${block.id}`, label: `${material.title || '材料'} · ${block.kind === 'image' ? '图片' : '内容'} ${i + 1}`, kind: 'material', materialId: material.id, blockId: block.id })),
    ]),
    ...group.optionPools.map((pool, i): SharedTarget => ({ key: `pool/${pool.id}`, label: `共用选项 ${i + 1}`, kind: 'pool', poolId: pool.id })),
  ]
}

export function ExamSharedFields({ draft, group, target, onChange }: {
  draft: ExamDraftInput; group: QuestionGroup; target: SharedTarget; onChange: (draft: ExamDraftInput) => void
}) {
  const updateGroup = (next: QuestionGroup) => onChange({ ...draft, content: { ...draft.content, groups: draft.content.groups.map(value => value.id === group.id ? next : value) } })
  if (target.kind === 'instruction') return <ActivityBlocks blocks={group.instructions.filter(block => block.id === target.blockId)}
    onChange={blocks => updateGroup({ ...group, instructions: group.instructions.map(block => blocks.find(value => value.id === block.id) ?? block) })} />
  if (target.kind === 'material') {
    const material = draft.content.materials.find(value => value.id === target.materialId)
    if (!material) return null
    const update = (next: typeof material) => onChange({ ...draft, content: { ...draft.content, materials: draft.content.materials.map(value => value.id === material.id ? next : value) } })
    return target.blockId ? <ActivityBlocks blocks={material.blocks.filter(block => block.id === target.blockId)}
      onChange={blocks => update({ ...material, blocks: material.blocks.map(block => blocks.find(value => value.id === block.id) ?? block) })} />
      : <DraftText label="材料标题" value={material.title} onChange={title => update({ ...material, title })} />
  }
  if (target.kind === 'pool') {
    const pool = group.optionPools.find(value => value.id === target.poolId)
    return pool ? <OptionFields options={pool.options} onChange={options => updateGroup({ ...group, optionPools: group.optionPools.map(value => value.id === pool.id ? { ...value, options } : value) })} /> : null
  }
  const activity = group.activities?.find(value => value.id === target.activityId)
  if (!activity) return null
  const update = (next: typeof activity) => updateGroup({ ...group, activities: group.activities?.map(value => value.id === activity.id ? next : value) })
  if (target.field === 'title') return <DraftText label="活动标题" value={activity.title} onChange={title => update({ ...activity, title })} />
  if (target.field === 'image') return <ImageSizeControl value={activity.imageDisplayWidth} onChange={imageDisplayWidth => update({ ...activity, imageDisplayWidth })} />
  if (target.field === 'wordBank') return <DraftText label="词库（每行一个）" multiline value={activity.wordBank?.join('\n') ?? ''} onChange={value => update({ ...activity, wordBank: value.split('\n') })} />
  const presentation = activity.choicePresentation
  return presentation ? <Flex direction="column" gap="3">{presentation.options.map((option, index) => <DraftText key={option.value} label={`选项 ${option.value}`} value={option.label}
    error={!option.label.trim() ? '选项文字不能为空。' : option.label.length > 50_000 ? '选项文字不能超过 50000 个字符。' : undefined}
    onChange={label => update({ ...activity, choicePresentation: { ...presentation, options: presentation.options.map((value, i) => i === index ? { ...value, label } : value) } })} />)}</Flex> : null
}
