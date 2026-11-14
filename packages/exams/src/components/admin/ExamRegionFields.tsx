'use client'

import type { ExamAuthoringTarget } from '../ExamAuthoringRegion'
import type { ExamDraftInput } from '../../validation/contracts'
import { ActivityBlocks, OptionFields } from './ExamActivityFields'
import { ExamSharedFields, type SharedTarget } from './ExamSharedFields'

export function ExamRegionFields({ draft, target, onChange }: {
  draft: ExamDraftInput; target: ExamAuthoringTarget; onChange: (draft: ExamDraftInput) => void
}) {
  const group = draft.content.groups.find(value => value.id === target.groupId)
  if (!group) return null
  if (target.kind === 'blocks') {
    const blocks = [...group.instructions, ...draft.content.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => material.blocks)]
      .filter(block => target.blockIds.includes(block.id))
    return <ActivityBlocks blocks={blocks} onChange={next => {
      const replace = (block: typeof blocks[number]) => next.find(value => value.id === block.id) ?? block
      onChange({ ...draft, content: { ...draft.content,
        groups: draft.content.groups.map(value => value.id === group.id ? { ...value, instructions: value.instructions.map(replace) } : value),
        materials: draft.content.materials.map(material => group.materialIds.includes(material.id) ? { ...material, blocks: material.blocks.map(replace) } : material),
      } })
    }} />
  }
  if (target.kind === 'options') {
    const question = group.questions.find(value => value.id === target.questionId)
    if (!question || (question.answerType !== 'single_choice' && question.answerType !== 'multiple_choice')) return null
    return <OptionFields options={question.options} onChange={options => onChange({ ...draft, content: { ...draft.content,
      groups: draft.content.groups.map(value => value.id === group.id ? { ...value,
        questions: value.questions.map(item => item.id === question.id ? { ...question, options } : item),
      } : value),
    } })} />
  }
  const shared: SharedTarget = { ...target, key: JSON.stringify(target), label: '共用内容' }
  return <ExamSharedFields draft={draft} group={group} target={shared} onChange={onChange} />
}
