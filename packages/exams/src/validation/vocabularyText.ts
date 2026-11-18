import type { ExamContentRevision, MaterialBlock, QuestionId } from '../types/content'

export interface ExamVocabularyText {
  path: string[]
  text: string
  questionIds: QuestionId[]
}

/** Only candidate-facing text, scoped to the questions that can disclose it. */
export function examVocabularyText(content: ExamContentRevision): ExamVocabularyText[] {
  const sources: ExamVocabularyText[] = []
  const materialQuestions = new Map<string, Set<QuestionId>>()
  const add = (path: string[], text: string, questionIds: QuestionId[]) => {
    if (text.trim() && questionIds.length) sources.push({ path, text, questionIds })
  }
  function addBlocks(path: string[], blocks: readonly MaterialBlock[], questionIds: QuestionId[]) {
    for (const block of blocks) {
      const at = [...path, block.id]
      if (block.kind === 'text' && block.presentation?.role !== 'instruction') add(at, block.text, questionIds)
      if (block.kind === 'email') {
        add([...at, 'subject'], block.subject, questionIds)
        block.body.forEach((paragraph, index) => add([...at, 'body', String(index)], paragraph, questionIds))
        block.notes?.forEach((note, index) => add([...at, 'note', String(index)], note.text, questionIds))
      }
      if (block.kind === 'table') {
        block.headers.forEach((cell, index) => add([...at, 'header', String(index)], cell, questionIds))
        block.rows.forEach((row, y) => row.forEach((cell, x) => add([...at, 'cell', String(y), String(x)], cell, questionIds)))
      }
      if (block.kind === 'image' && block.caption) add([...at, 'caption'], block.caption, questionIds)
    }
  }
  for (const group of content.groups) {
    const questions = group.questions.filter(question => question.scoring.kind !== 'example')
    for (const id of group.materialIds) {
      const ids = materialQuestions.get(id) ?? new Set<QuestionId>()
      questions.forEach(question => ids.add(question.id))
      materialQuestions.set(id, ids)
    }
    for (const question of questions) {
      const at = ['question', question.id]
      addBlocks([...at, 'prompt'], question.prompt, [question.id])
      if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') {
        question.options.forEach(option => add([...at, 'option', option.id], option.label, [question.id]))
      }
      if (question.answerType === 'matching') {
        question.items.forEach(item => addBlocks([...at, 'item', item.id], item.prompt, [question.id]))
      }
    }
    for (const pool of group.optionPools) {
      const ids = questions.filter(question => (question.answerType === 'matching' || question.answerType === 'gap_fill')
        && question.optionPoolId === pool.id).map(question => question.id)
      pool.options.forEach(option => add(['group', group.id, 'pool', pool.id, option.id], option.label, ids))
    }
  }
  for (const material of content.materials) {
    addBlocks(['material', material.id], material.blocks, [...materialQuestions.get(material.id) ?? []])
  }
  return sources
}
