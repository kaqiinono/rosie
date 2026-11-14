import 'server-only'

import type { ExamMediaEditor, MaterialBlock } from '@rosie/exams'
import type { ExamDraftInput } from '@rosie/exams/validation'

/** Membership comes from authored relationships, never parsed identifiers or filenames. */
export function examMediaParts(draft: ExamDraftInput): ExamMediaEditor['parts'] {
  const names: Record<string, string> = { listening: 'Listening', reading_writing: 'Reading & Writing', speaking: 'Speaking' }
  const parts = new Map<string, { sectionId: string; partNumber: number; label: string; slotIds: Set<string> }>()
  const slots = [...draft.content.mediaSlots, ...draft.solutions.mediaSlots]
  for (const group of draft.content.groups) {
    const key = `${group.sectionId}:${group.partNumber}`
    const part = parts.get(key) ?? { sectionId: group.sectionId, partNumber: group.partNumber,
      label: `${names[group.sectionId] ?? group.sectionId} Part ${group.partNumber}`, slotIds: new Set<string>() }
    const guidance = draft.content.guidance.filter(item => item.groupIds.includes(group.id))
    const notes = draft.solutions.teacherNotes.filter(item => item.groupIds.includes(group.id)
      || item.sectionId === group.sectionId && item.partNumber === group.partNumber)
    const references = new Set<string>()
    const blocks = (items: readonly MaterialBlock[]) => items.forEach(block => {
      if (block.kind === 'audio' || block.kind === 'image') references.add(block.mediaSlotId)
    })
    blocks(group.instructions)
    draft.content.materials.filter(item => group.materialIds.includes(item.id)).forEach(item => blocks(item.blocks))
    guidance.forEach(item => blocks(item.blocks))
    notes.forEach(item => blocks(item.blocks))
    group.optionPools.forEach(pool => pool.options.forEach(option => { if (option.imageSlotId) references.add(option.imageSlotId) }))
    group.activities?.forEach(activity => { if (activity.imageSlotId) references.add(activity.imageSlotId) })
    group.questions.forEach(question => {
      blocks(question.prompt)
      if (question.answerType === 'matching') question.items.forEach(item => blocks(item.prompt))
      if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') {
        question.options.forEach(option => { if (option.imageSlotId) references.add(option.imageSlotId) })
      }
    })
    for (const slot of slots) {
      if (references.has(slot.id)
        || slot.target.kind === 'group' && slot.target.id === group.id
        || slot.target.kind === 'guidance' && guidance.some(item => item.id === slot.target.id)
        || slot.target.kind === 'teacher_notes' && notes.some(item => item.id === slot.target.id)) part.slotIds.add(slot.id)
    }
    parts.set(key, part)
  }
  return [...parts.values()].map(part => ({ ...part, slotIds: [...part.slotIds] }))
}
