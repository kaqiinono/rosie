import type { MaterialBlock } from '../types/content'
import type { Question } from '../types/questions'

/** Only omit plain text already displayed in this activity; preserve interactive content. */
export function visibleExamPrompt(prompt: readonly MaterialBlock[], sharedInstructions: readonly MaterialBlock[] = []): MaterialBlock[] {
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ')
  return prompt.filter(block => {
    if (block.kind !== 'text' || block.answerSlots?.length || block.sentences?.length) return true
    const text = normalize(block.text)
    return !sharedInstructions.some(instruction => {
      if (instruction.kind !== 'text' || instruction.presentation?.role !== 'instruction'
        || instruction.answerSlots?.length || instruction.sentences?.length) return false
      const shared = normalize(instruction.text)
      return shared.length > 0 && (text === shared || text === `Exercise ${instruction.presentation.number}. ${shared}`)
    })
  })
}

export function questionPromptBlocks(question: Question): readonly MaterialBlock[] {
  if (question.prompt.length) return question.prompt
  if (question.answerType === 'matching') return question.items.flatMap(item => item.prompt)
  return []
}

/** Audio with no remaining question text belongs on the instruction, together with a repeated slot. */
export function titleAudioSlotIds(instructions: readonly MaterialBlock[], prompts: readonly (readonly MaterialBlock[])[], repeatedSlotIds: readonly string[] = []): string[] {
  const ids = [...repeatedSlotIds]
  for (const prompt of prompts) {
    const visible = visibleExamPrompt(prompt, instructions)
    const firstText = visible.findIndex(block => block.kind === 'text')
    for (const [index, block] of visible.entries()) {
      if (block.kind === 'audio' && (firstText === -1 || index < firstText)) ids.push(block.mediaSlotId)
    }
  }
  return [...new Set(ids)]
}
