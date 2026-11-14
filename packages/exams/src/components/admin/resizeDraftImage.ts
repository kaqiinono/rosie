import type { ExamActivity, ExamOption, MaterialBlock } from '../../types/content'
import type { ExamDraftInput } from '../../validation/contracts'

function sized<T extends { displayWidth?: number }>(value: T, displayWidth: number | undefined): T {
  const next = { ...value }
  if (displayWidth === undefined) delete next.displayWidth
  else next.displayWidth = displayWidth
  return next
}

function sizedActivity(activity: ExamActivity, slotId: string, displayWidth: number | undefined): ExamActivity {
  if (activity.imageSlotId !== slotId) return activity
  const next = { ...activity }
  if (displayWidth === undefined) delete next.imageDisplayWidth
  else next.imageDisplayWidth = displayWidth
  return next
}

/** A shared image slot retains one display width across its references. */
export function resizeDraftImage(draft: ExamDraftInput, slotId: string, displayWidth: number | undefined): ExamDraftInput {
  const blocks = (values: readonly MaterialBlock[]) => values.map(block => block.kind === 'image' && block.mediaSlotId === slotId ? sized(block, displayWidth) : block)
  const options = (values: readonly ExamOption[]) => values.map(option => option.imageSlotId === slotId ? sized(option, displayWidth) : option)
  return {
    ...draft,
    content: {
      ...draft.content,
      materials: draft.content.materials.map(material => ({ ...material, blocks: blocks(material.blocks) })),
      groups: draft.content.groups.map(group => {
        const { activities, ...rest } = group
        return {
          ...rest,
          instructions: blocks(group.instructions),
          ...(activities ? { activities: activities.map(activity => sizedActivity(activity, slotId, displayWidth)) } : {}),
          optionPools: group.optionPools.map(pool => ({ ...pool, options: options(pool.options) })),
          questions: group.questions.map(question => {
            const prompt = blocks(question.prompt)
            if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') return { ...question, prompt, options: options(question.options) }
            if (question.answerType === 'matching') return { ...question, prompt, items: question.items.map(item => ({ ...item, prompt: blocks(item.prompt) })) }
            return { ...question, prompt }
          }),
        }
      }),
    },
  }
}
