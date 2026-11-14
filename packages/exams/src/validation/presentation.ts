import type { MaterialBlock } from '../types/content'
import { issue, type ExamDraftInput, type ValidationIssue } from './contracts'

/** Presentation references are authored relationships, never browser/OCR guesses. */
export function validatePresentation(draft: ExamDraftInput, issues: ValidationIssue[]) {
  const fail = (path: string, message: string) => issue(issues, path, 'invalid_presentation', message)
  for (const [index, material] of draft.content.materials.entries()) {
    if (!material.layout) continue
    const path = `$.content.materials[${index}].layout`
    const used = new Set<string>()
    const rows = new Set<string>()
    for (const row of material.layout) {
      if (rows.has(row.id)) fail(path, 'Layout row IDs must be unique.')
      rows.add(row.id)
      const refs = [...row.bodyBlockIds, ...(row.headingBlockId ? [row.headingBlockId] : []), ...(row.imageBlockId ? [row.imageBlockId] : [])]
      if (!refs.length) fail(path, 'Layout rows cannot be empty.')
      for (const id of refs) {
        const block = material.blocks.find(block => block.id === id)
        if (!block || used.has(id)) fail(path, 'Layout blocks must resolve exactly once inside their material.')
        used.add(id)
      }
      if (row.headingBlockId && !material.blocks.some(block => block.id === row.headingBlockId && block.kind === 'text' && block.presentation?.role === 'heading')) fail(path, 'A row heading must reference a heading text block.')
      if (row.imageBlockId && !material.blocks.some(block => block.id === row.imageBlockId && block.kind === 'image' && block.aspectRatio)) fail(path, 'A row image requires an image block with an explicit aspect ratio.')
      if (Boolean(row.imageBlockId) !== Boolean(row.imageSide)) fail(path, 'Image reference and side must be specified together.')
    }
    if (material.blocks.some(block => !used.has(block.id))) fail(path, 'A material layout must cover every block.')
  }
  for (const [gi, group] of draft.content.groups.entries()) {
    const root = `$.content.groups[${gi}]`
    const questions = new Map(group.questions.map(question => [question.id, question]))
    const blocks = [...group.instructions, ...draft.content.materials.filter(material => group.materialIds.includes(material.id)).flatMap(material => [...material.blocks]), ...group.questions.flatMap(question => [...question.prompt])]
    const slotRefs = new Set<string>()
    for (const block of blocks) {
      const path = `${root}.blocks.${block.id}`
      if (block.kind === 'text' && block.presentation && (block.answerSlots?.length || block.sentences?.length)) fail(path, 'Headings and numbered instructions cannot contain answer or sentence ranges.')
      const sourceText = (row?: number, column?: number): string | undefined => {
        if (block.kind === 'text' && row === undefined && column === undefined) return block.text
        if (block.kind === 'email' && row !== undefined && column === undefined) return block.body[row]
        if (block.kind === 'table' && row !== undefined && column !== undefined) return block.rows[row]?.[column]
        return undefined
      }
      const priorEnds = new Map<string, number>()
      for (const slot of block.answerSlots ?? []) {
        const text = sourceText(slot.row, slot.column)
        if (slot.sourceText !== undefined && text?.slice(slot.start, slot.end) !== slot.sourceText) fail(path, 'Source text changed; re-anchor the answer slot before saving.')
        const q = questions.get(slot.questionId)
        const ref = `${slot.questionId}/${slot.gapId ?? ''}`
        if (slotRefs.has(ref)) fail(path, 'Each answer slot may appear only once per group.')
        slotRefs.add(ref)
        const cell = `${slot.row}:${slot.column}`
        if (text === undefined || slot.end <= slot.start || slot.end > text.length || slot.start < (priorEnds.get(cell) ?? 0)) fail(path, 'Answer slots must be ordered, non-overlapping ranges within their text cell.')
        if (!q || (q.answerType !== 'single_choice' && q.answerType !== 'gap_fill') || (q.answerType === 'gap_fill' ? !q.gaps.some(gap => gap.id === slot.gapId) : slot.gapId !== undefined)) fail(path, 'An inline slot must resolve to a choice question or an explicit gap in this group.')
        priorEnds.set(cell, slot.end)
      }
      let end = 0
      const ids = new Set<string>()
      for (const sentence of block.sentences ?? []) {
        if (block.kind !== 'text' || block.answerSlots?.length || ids.has(sentence.id) || sentence.start < end || sentence.end <= sentence.start || sentence.end > (block as Extract<MaterialBlock, { kind: 'text' }>).text.length) fail(path, 'Sentence ranges must be unique ordered ranges in a text block without answer slots.')
        if (sentence.sourceText !== undefined && (block.kind !== 'text' || block.text.slice(sentence.start, sentence.end) !== sentence.sourceText)) fail(path, 'Source text changed; re-anchor the sentence before saving.')
        ids.add(sentence.id); end = sentence.end
      }
    }
    for (const question of group.questions) {
      if (question.exampleText && question.scoring.kind !== 'example') fail(root, 'Only printed examples may include a public example answer.')
      if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') {
        if (question.answerType === 'multiple_choice' && question.selectionCount > question.options.length) fail(root, 'Selection count exceeds the option count.')
        for (const option of question.options) if (option.imageRegion && (!option.imageSlotId || option.imageRegion.x + option.imageRegion.width > 1.000001 || option.imageRegion.y + option.imageRegion.height > 1.000001)) fail(root, 'An option viewport must remain inside its bound image.')
      }
    }
    if (group.activities) {
      const visibleMaterials = new Set(group.activities.flatMap(activity => [...activity.materialIds]))
      const visibleInstructions = new Set(group.activities.flatMap(activity => [...activity.instructionIds]))
      for (const material of draft.content.materials.filter(material => group.materialIds.includes(material.id))) {
        if (!visibleMaterials.has(material.id) && material.blocks.some(block => block.answerSlots?.length)) fail(root, 'A material with answer slots must be visible in an activity.')
      }
      if (group.instructions.some(block => block.answerSlots?.length && !visibleInstructions.has(block.id))) fail(root, 'An instruction with answer slots must be visible in an activity.')
      const covered = new Set<string>()
      const activityIds = new Set<string>()
      for (const activity of group.activities) {
        if (activityIds.has(activity.id)) fail(root, 'Activity IDs must be unique.')
        activityIds.add(activity.id)
        if (activity.instructionIds.some(id => !group.instructions.some(block => block.id === id)) || activity.materialIds.some(id => !group.materialIds.includes(id))) fail(root, 'Activity material/instruction references must resolve inside the group.')
        for (const id of activity.questionIds) {
          if (!questions.has(id) || covered.has(id)) fail(root, 'Each question must belong to exactly one activity.')
          covered.add(id)
        }
        if (activity.imageSlotId && !draft.content.mediaSlots.some(slot => slot.id === activity.imageSlotId && slot.purpose === 'question_image' && (slot.target.kind === 'content_set' || slot.target.id === group.id))) fail(root, 'Activity illustration must be an image within the group scope.')
        if (activity.layout === 'image_labels' && !activity.imageSlotId) fail(root, 'Image labels require an illustration.')
        if (activity.choicePresentation) {
          const values = activity.choicePresentation.options.map(option => option.value)
          if (activity.layout !== 'handwriting' || new Set(values).size !== values.length || activity.questionIds.some(id => {
            const question = questions.get(id)
            return question?.answerType !== 'gap_fill' || !!question.optionPoolId || question.gaps.length !== 1
          })) fail(root, 'Choice/handwriting activities require unique authored values and one open gap per question.')
          if (activity.choicePresentation.kind === 'judgment' && (values.length !== 2 || !values.includes('✓') || !values.includes('✗'))) fail(root, 'Judgment choices must explicitly map to ✓ and ✗.')
        }
        if (activity.layout === 'handwriting' && activity.questionIds.some(id => {
          const question = questions.get(id)
          return question?.answerType !== 'gap_fill' || !!question.optionPoolId
        })) fail(root, 'Handwriting activities require open gap-fill questions; word banks are reading material only.')
        if (activity.layout === 'matching' || activity.layout === 'image_labels') {
          const entries = activity.questionIds.map(id => questions.get(id)).filter(q => q !== undefined)
          const pools = new Set(entries.map(q => q.answerType === 'matching' || q.answerType === 'gap_fill' ? q.optionPoolId : undefined))
          if (pools.has(undefined) || pools.size !== 1) fail(root, 'A matching activity must use one explicit shared option pool.')
          if (activity.layout === 'image_labels' && entries.some(q => q.answerType !== 'gap_fill' || q.gaps.length !== 1)) fail(root, 'Image labels require one gap per printed number.')
        }
        const positions = new Set<string>()
        for (const position of activity.positions ?? []) {
          if (positions.has(position.questionId) || !activity.questionIds.includes(position.questionId)) fail(root, 'Illustration positions must resolve to unique activity questions.')
          positions.add(position.questionId)
        }
        if (activity.layout === 'image_labels' && activity.questionIds.some(id => questions.get(id)?.scoring.kind !== 'example' && !positions.has(id))) fail(root, 'Every scored image label requires an authored position.')
      }
      if (covered.size !== questions.size) fail(root, 'Activities must cover every question, including examples.')
    }
  }
}
