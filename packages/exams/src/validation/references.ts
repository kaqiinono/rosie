import { validatePresentation } from './presentation'
import { examVocabularyText } from './vocabularyText'
import { resolveExamTemplate } from '../templates/examTemplates'
import type { ContentProvenance, ExamOption, MaterialBlock, MediaSlot, QuestionGroup, SourceReference } from '../types/content'
import type { Question } from '../types/questions'
import type { Explanation, Solution } from '../types/solutions'
import { issue, type ExamDraftInput, type ValidationIssue } from './contracts'

function unique(values: readonly string[], path: string, issues: ValidationIssue[]): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value)) issue(issues, `${path}[${index}]`, 'duplicate_id', 'Identifiers must be unique within their scope.')
    seen.add(value)
  })
}

export function validateDraftReferences(draft: ExamDraftInput, issues: ValidationIssue[]): void {
  validatePresentation(draft, issues)
  const { contentSet, content, solutions } = draft
  const fail = (path: string, code: string, message: string): void => issue(issues, path, code, message)
  const template = resolveExamTemplate(contentSet.template)
  if (!template) {
    fail('$.contentSet.template', 'unknown_template', 'Only registered template versions may be referenced.')
    return
  }
  const materials = new Map(content.materials.map(material => [material.id, material]))
  const groups = new Map(content.groups.map(group => [group.id, group]))
  const guidance = new Map(content.guidance.map(item => [item.id, item]))
  const notes = new Map(solutions.teacherNotes.map(note => [note.id, note]))
  const media = new Map<string, MediaSlot>([...content.mediaSlots, ...solutions.mediaSlots].map(slot => [slot.id, slot]))
  const questionEntries = content.groups.flatMap((group, groupIndex) => group.questions.map((question, questionIndex) => ({ question, group, path: `$.content.groups[${groupIndex}].questions[${questionIndex}]` })))
  const questions = new Map(questionEntries.map(entry => [entry.question.id, entry]))
  const materialGroups = new Map<string, string>()
  const references: { ref: SourceReference; path: string; student: boolean }[] = []

  if (content.contentSetId !== contentSet.id) fail('$.content.contentSetId', 'reference_mismatch', 'Content must belong to the supplied content set.')
  if (solutions.contentRevisionId !== content.id) fail('$.solutions.contentRevisionId', 'reference_mismatch', 'Solutions must belong to the supplied content revision.')

  const entityEntries = [
    ...content.materials.map((item, index) => ({ id: item.id, path: `$.content.materials[${index}].id` })),
    ...content.groups.map((item, index) => ({ id: item.id, path: `$.content.groups[${index}].id` })),
    ...content.guidance.map((item, index) => ({ id: item.id, path: `$.content.guidance[${index}].id` })),
    ...content.vocabularyLinks.map((item, index) => ({ id: item.id, path: `$.content.vocabularyLinks[${index}].id` })),
    ...content.mediaSlots.map((item, index) => ({ id: item.id, path: `$.content.mediaSlots[${index}].id` })),
    ...solutions.mediaSlots.map((item, index) => ({ id: item.id, path: `$.solutions.mediaSlots[${index}].id` })),
    ...solutions.solutions.map((item, index) => ({ id: item.id, path: `$.solutions.solutions[${index}].id` })),
    ...solutions.teacherNotes.map((item, index) => ({ id: item.id, path: `$.solutions.teacherNotes[${index}].id` })),
    ...questionEntries.map(item => ({ id: item.question.id, path: `${item.path}.id` })),
  ]
  const entityIds = new Set<string>()
  entityEntries.forEach(entry => {
    if (entityIds.has(entry.id)) fail(entry.path, 'duplicate_id', 'Entity identifiers must be unique within the draft.')
    entityIds.add(entry.id)
  })
  const solutionQuestionIds = new Set<string>()
  solutions.solutions.forEach((solution, index) => {
    if (solutionQuestionIds.has(solution.questionId)) fail(`$.solutions.solutions[${index}].questionId`, 'duplicate_id', 'A question may have only one solution record containing its complete alternatives.')
    solutionQuestionIds.add(solution.questionId)
  })

  const checkReference = (ref: SourceReference, path: string, student = false): void => {
    references.push({ ref, path, student })
    if (ref.sourceId !== contentSet.source.id) fail(`${path}.sourceId`, 'source_mismatch', 'Every source reference must identify this content set’s source edition.')
    if (ref.region && (ref.region.x + ref.region.width > 1 + 1e-9 || ref.region.y + ref.region.height > 1 + 1e-9)) {
      fail(`${path}.region`, 'crop_out_of_bounds', 'Crop must remain within the normalized source page.')
    }
    if (student && (ref.role === 'solution' || ref.role === 'teacher_notes')) fail(`${path}.role`, 'private_source', 'Student content cannot refer to private source material.')
  }
  const checkProvenance = (value: ContentProvenance, path: string, student = false): void => {
    value.sources.forEach((ref, index) => checkReference(ref, `${path}.sources[${index}]`, student))
  }
  const checkSection = (sectionId: string, partNumber: number, path: string) => {
    const section = template.sections.find(item => item.id === sectionId)
    const part = section?.parts.find(item => item.number === partNumber)
    if (!part) fail(path, 'unknown_part', 'Section and Part must resolve in the selected template.')
    return part
  }
  const checkGroupIds = (ids: readonly string[], path: string): void => {
    unique(ids, path, issues)
    ids.forEach((groupId, index) => {
      if (!groups.has(groupId)) fail(`${path}[${index}]`, 'unknown_group', 'Referenced group does not exist.')
    })
  }

  content.groups.forEach((group, index) => {
    const path = `$.content.groups[${index}]`
    unique(group.materialIds, `${path}.materialIds`, issues)
    group.materialIds.forEach((materialId, materialIndex) => {
      const material = materials.get(materialId)
      const referencePath = `${path}.materialIds[${materialIndex}]`
      if (!material) fail(referencePath, 'unknown_material', 'Referenced material does not exist.')
      else if (material.role !== group.role) fail(referencePath, 'role_mismatch', 'Group and shared material roles must agree.')
      const priorGroup = materialGroups.get(materialId)
      if (priorGroup && priorGroup !== group.id) fail(referencePath, 'split_material', 'A shared material must remain in one complete group.')
      materialGroups.set(materialId, group.id)
    })
  })

  type Scope = { kind: 'group' | 'guidance' | 'teacher_notes'; id: string }
  const useMedia = (slotId: string, path: string, student: boolean, kind: 'image' | 'audio', scope?: Scope): void => {
    const slot = media.get(slotId)
    if (!slot) {
      fail(path, 'unknown_media', 'Referenced media slot does not exist.')
      return
    }
    if (student && slot.audience !== 'student') fail(path, 'private_media', 'Student content cannot reference private media.')
    const isImage = ['question_image', 'solution_image', 'examiner_image', 'source_page'].includes(slot.purpose)
    if ((kind === 'image') !== isImage) fail(path, 'media_kind_mismatch', 'Media purpose must match the referencing block or option.')
    if (slot.target.kind !== 'content_set' && scope && (slot.target.kind !== scope.kind || slot.target.id !== scope.id)) {
      fail(path, 'media_scope_mismatch', 'Media target must match the containing content scope.')
    }
  }
  const checkBlocks = (blocks: readonly MaterialBlock[], path: string, student: boolean, scope?: Scope): void => {
    unique(blocks.map(block => block.id), path, issues)
    blocks.forEach((block, index) => {
      if (block.kind === 'image' || block.kind === 'audio') useMedia(block.mediaSlotId, `${path}[${index}].mediaSlotId`, student, block.kind, scope)
      if (block.kind === 'table' && block.rows.some(row => row.length !== block.headers.length)) fail(`${path}[${index}].rows`, 'table_width_mismatch', 'Table rows must have one cell per header.')
      if (block.kind === 'email' && block.notes?.some(note => note.paragraph >= block.body.length)) {
        fail(`${path}[${index}].notes`, 'invalid_email_note', 'Each note must refer to an existing email paragraph.')
      }
    })
  }
  const checkOptions = (options: readonly ExamOption[], path: string, group: QuestionGroup): void => {
    unique(options.map(option => option.id), path, issues)
    options.forEach((option, index) => {
      if (option.imageSlotId) useMedia(option.imageSlotId, `${path}[${index}].imageSlotId`, true, 'image', { kind: 'group', id: group.id })
    })
  }

  content.materials.forEach((material, index) => {
    const path = `$.content.materials[${index}]`
    const groupId = materialGroups.get(material.id)
    const group = groupId ? groups.get(groupId) : undefined
    const part = template.sections.find(section => section.id === group?.sectionId)?.parts.find(item => item.number === group?.partNumber)
    if (material.speakingCandidate && (!part?.speakingCandidatePhotos || material.blocks.filter(block => block.kind === 'image').length !== 1)) {
      fail(path, 'invalid_speaking_photo', 'Each candidate photo must belong to an extended-turn Part and include one image.')
    }
    checkBlocks(material.blocks, `${path}.blocks`, true, groupId ? { kind: 'group', id: groupId } : undefined)
    checkProvenance(material.provenance, `${path}.provenance`, true)
  })
  content.groups.forEach((group, index) => {
    const path = `$.content.groups[${index}]`
    const part = checkSection(group.sectionId, group.partNumber, path)
    if (group.role === 'exam' && (group.writingChoice !== part?.writingChoice
      || (group.writingChoice && (group.questions.length !== 2 || group.questions.some(question => question.answerType !== 'writing' || question.scoring.kind !== 'manual'))))) {
      fail(path, 'invalid_writing_choice', 'Writing alternatives must be kept together as two manual writing questions in one response group.')
    }
    if (group.role === 'exam' && part?.speakingCandidatePhotos) {
      const photos = group.materialIds.flatMap(id => materials.get(id)?.speakingCandidate ?? [])
      if (photos.length !== 2 || !photos.includes('A') || !photos.includes('B')) {
        fail(path, 'invalid_speaking_photo', 'The extended turn requires separate materials for candidate A and candidate B.')
      }
    }
    checkProvenance(group.provenance, `${path}.provenance`, true)
    checkBlocks(group.instructions, `${path}.instructions`, true, { kind: 'group', id: group.id })
    unique(group.optionPools.map(pool => pool.id), `${path}.optionPools`, issues)
    group.optionPools.forEach((pool, poolIndex) => checkOptions(pool.options, `${path}.optionPools[${poolIndex}].options`, group))
  })

  questionEntries.forEach(({ question, group, path }) => {
    const location = question.location
    const expectedId = `${location.sourceId}:test-${location.testNumber}:${location.role}:${location.sectionId}:part-${location.partNumber}:${location.questionNumber}`
    if (question.id !== expectedId) fail(`${path}.id`, 'question_id_mismatch', 'Question ID must preserve every source location component.')
    if (location.sourceId !== contentSet.source.id || location.testNumber !== contentSet.testNumber) fail(`${path}.location`, 'source_mismatch', 'Question location must match the source edition and test number of the content set.')
    if (location.role !== group.role || location.sectionId !== group.sectionId || location.partNumber !== group.partNumber) fail(`${path}.location`, 'group_location_mismatch', 'Question role, section and Part must match its containing group.')
    const part = checkSection(location.sectionId, location.partNumber, `${path}.location`)
    if (part && question.location.role === 'exam' && (!part.answerTypes.includes(question.answerType) || !part.domains.includes(question.classification.domain) || part.questionTypeId !== question.classification.questionTypeId)) {
      fail(`${path}.classification`, 'template_mismatch', 'Exam question type and classification must match the template Part.')
    }
    checkProvenance(question.provenance, `${path}.provenance`, true)
    checkBlocks(question.prompt, `${path}.prompt`, true, { kind: 'group', id: group.id })
    unique(question.classification.knowledgePointIds, `${path}.classification.knowledgePointIds`, issues)
    unique(question.classification.topicIds, `${path}.classification.topicIds`, issues)
    if (question.scoring.kind === 'example' && !/example/i.test(location.questionNumber)) fail(`${path}.location.questionNumber`, 'example_id_required', 'Book examples need an explicit example identifier.')
    if (question.scoring.kind === 'manual') {
      const rubricId = question.scoring.rubricId
      if (!template.rubrics.some(rubric => rubric.id === rubricId && rubric.domain === question.answerType)) fail(`${path}.scoring.rubricId`, 'unknown_rubric', 'Manual rubric must match the question domain in the selected template.')
    }
    if (question.answerType === 'single_choice' || question.answerType === 'multiple_choice') checkOptions(question.options, `${path}.options`, group)
    if (question.answerType === 'gap_fill') unique(question.gaps.map(gap => gap.id), `${path}.gaps`, issues)
    if (question.answerType === 'self_check') unique(question.checklist.map(item => item.id), `${path}.checklist`, issues)
    if (question.answerType === 'matching') {
      unique(question.items.map(item => item.id), `${path}.items`, issues)
      question.items.forEach((item, index) => checkBlocks(item.prompt, `${path}.items[${index}].prompt`, true, { kind: 'group', id: group.id }))
    }
    if ((question.answerType === 'matching' || question.answerType === 'gap_fill') && question.optionPoolId && !group.optionPools.some(pool => pool.id === question.optionPoolId)) {
      fail(`${path}.optionPoolId`, 'unknown_option_pool', 'Option pool must resolve within the containing group.')
    }
  })

  content.guidance.forEach((item, index) => {
    const path = `$.content.guidance[${index}]`
    checkGroupIds(item.groupIds, `${path}.groupIds`)
    checkBlocks(item.blocks, `${path}.blocks`, true, { kind: 'guidance', id: item.id })
    checkProvenance(item.provenance, `${path}.provenance`, true)
  })
  const matchSources = new Map((content.vocabularyLinks.some(link => link.matchSource) ? examVocabularyText(content) : [])
    .map(source => [JSON.stringify(source.path), source] as const))
  content.vocabularyLinks.forEach((link, index) => {
    const path = `$.content.vocabularyLinks[${index}]`
    unique(link.questionIds, `${path}.questionIds`, issues)
    if (link.matchSource) {
      const source = matchSources.get(JSON.stringify(link.matchSource))
      if (!source || link.materialId !== undefined || link.blockId !== undefined) {
        fail(`${path}.matchSource`, 'invalid_vocabulary_block', 'An automatic match must identify a single public text source.')
      } else if (link.textRange.end <= link.textRange.start || link.textRange.end > source.text.length
        || source.text.slice(link.textRange.start, link.textRange.end) !== link.matchedForm) {
        fail(`${path}.textRange`, 'invalid_text_range', 'Vocabulary UTF-16 range must identify its exact matched form.')
      } else if (source.questionIds.length !== link.questionIds.length || link.questionIds.some(id => !source.questionIds.includes(id))) {
        fail(`${path}.questionIds`, 'vocabulary_scope_mismatch', 'An automatic match must retain the source text’s question scope.')
      }
      return
    }
    const materialId = link.materialId
    const material = materialId ? materials.get(materialId) : undefined
    const block = material?.blocks.find(item => item.id === link.blockId)
    if (!material) fail(`${path}.materialId`, 'unknown_material', 'Vocabulary material does not exist.')
    if (!block || block.kind !== 'text') fail(`${path}.blockId`, 'invalid_vocabulary_block', 'Vocabulary ranges must refer to a text block in their material.')
    else if (link.textRange.end <= link.textRange.start || link.textRange.end > block.text.length || block.text.slice(link.textRange.start, link.textRange.end) !== link.matchedForm) {
      fail(`${path}.textRange`, 'invalid_text_range', 'Vocabulary UTF-16 range must identify its exact matched form.')
    }
    link.questionIds.forEach((questionId, questionIndex) => {
      const entry = questions.get(questionId)
      if (!entry) fail(`${path}.questionIds[${questionIndex}]`, 'unknown_question', 'Vocabulary question does not exist.')
      else if (materialId === undefined || !entry.group.materialIds.includes(materialId)) fail(`${path}.questionIds[${questionIndex}]`, 'vocabulary_scope_mismatch', 'Vocabulary question must belong to the group containing its material.')
    })
  })
  solutions.teacherNotes.forEach((note, index) => {
    const path = `$.solutions.teacherNotes[${index}]`
    checkSection(note.sectionId, note.partNumber, path)
    checkGroupIds(note.groupIds, `${path}.groupIds`)
    note.groupIds.forEach((groupId, groupIndex) => {
      const group = groups.get(groupId)
      if (group && (group.sectionId !== note.sectionId || group.partNumber !== note.partNumber)) fail(`${path}.groupIds[${groupIndex}]`, 'note_scope_mismatch', 'Teacher notes must reference groups in their own section and Part.')
    })
    checkBlocks(note.blocks, `${path}.blocks`, false, { kind: 'teacher_notes', id: note.id })
    checkProvenance(note.provenance, `${path}.provenance`)
  })

  const checkExplanations = (items: readonly Explanation[], path: string): void => items.forEach((item, index) => checkProvenance(item.provenance, `${path}[${index}].provenance`))
  // Only definite assignments can conflict across questions. Alternative combinations
  // may have a feasible joint choice; readiness reports those for later review.
  const poolUsage = new Map<string, Map<string, string>>()
  const recordPoolUse = (group: QuestionGroup, question: Question, optionIds: readonly string[], path: string): void => {
    if (question.answerType !== 'matching' && question.answerType !== 'gap_fill') return
    const pool = group.optionPools.find(item => item.id === question.optionPoolId)
    if (!pool || pool.allowReuse || question.scoring.kind === 'example') return
    const key = JSON.stringify([group.id, pool.id])
    const used = poolUsage.get(key) ?? new Map<string, string>()
    for (const optionId of optionIds) {
      const priorQuestion = used.get(optionId)
      if (priorQuestion && priorQuestion !== question.id) fail(path, 'pool_reuse', 'A non-reusable option pool cannot assign the same option to different questions.')
      used.set(optionId, question.id)
    }
    poolUsage.set(key, used)
  }
  solutions.solutions.forEach((solution, index) => {
    const path = `$.solutions.solutions[${index}]`
    const entry = questions.get(solution.questionId)
    checkProvenance(solution.provenance, `${path}.provenance`)
    checkExplanations(solution.explanations, `${path}.explanations`)
    unique(solution.distractors.map(item => item.optionId), `${path}.distractors`, issues)
    solution.distractors.forEach((item, distractorIndex) => checkProvenance(item.explanation.provenance, `${path}.distractors[${distractorIndex}].explanation.provenance`))
    solution.evidence.forEach((item, evidenceIndex) => {
      const evidencePath = `${path}.evidence[${evidenceIndex}]`
      checkReference(item.source, `${evidencePath}.source`)
      const material = item.materialId ? materials.get(item.materialId) : undefined
      if (item.materialId && !material) fail(`${evidencePath}.materialId`, 'unknown_material', 'Evidence material does not exist.')
      if (item.blockId && !material?.blocks.some(block => block.id === item.blockId)) fail(`${evidencePath}.blockId`, 'unknown_block', 'Evidence block must resolve within its referenced material.')
    })
    if (!entry) {
      fail(`${path}.questionId`, 'unknown_question', 'Solution question does not exist.')
      return
    }
    const { question, group } = entry
    if (solution.answerType !== question.answerType) fail(`${path}.answerType`, 'answer_type_mismatch', 'Solution and question answer types must agree.')
    const optionPool = question.answerType === 'matching' || question.answerType === 'gap_fill' ? group.optionPools.find(pool => pool.id === question.optionPoolId) : undefined
    const optionIds = new Set(question.answerType === 'single_choice' || question.answerType === 'multiple_choice' ? question.options.map(option => option.id) : optionPool?.options.map(option => option.id))
    solution.distractors.forEach((item, distractorIndex) => {
      if (!optionIds.has(item.optionId)) fail(`${path}.distractors[${distractorIndex}].optionId`, 'unknown_option', 'Distractor must resolve in the question’s options or shared pool.')
      if (solution.answerType === 'single_choice' && item.optionId === solution.correctOptionId) fail(`${path}.distractors[${distractorIndex}].optionId`, 'correct_option_as_distractor', 'A correct option cannot be labeled a distractor.')
    })
    validateAnswer(solution, question, group, path, issues, ids => recordPoolUse(group, question, ids, path))
    if (solution.answerType === 'writing') {
      unique(solution.samples.map(sample => sample.id), `${path}.samples`, issues)
      checkExplanations(solution.taskGuidance, `${path}.taskGuidance`)
      solution.samples.forEach((sample, sampleIndex) => {
        const samplePath = `${path}.samples[${sampleIndex}]`
        checkProvenance(sample.provenance, `${samplePath}.provenance`)
        checkExplanations(sample.originalComments, `${samplePath}.originalComments`)
        checkExplanations(sample.supplementaryComments, `${samplePath}.supplementaryComments`)
        if (sample.originalScore) {
          checkReference(sample.originalScore.source, `${samplePath}.originalScore.source`)
          if (sample.originalScore.score > sample.originalScore.maximum) fail(`${samplePath}.originalScore`, 'score_out_of_bounds', 'A source sample score cannot exceed its source maximum.')
        }
      })
    }
    if (solution.answerType === 'speaking') checkExplanations(solution.reviewGuidance, `${path}.reviewGuidance`)
    if (solution.answerType === 'self_check') checkExplanations(solution.guidance, `${path}.guidance`)
  })

  const checkMedia = (slot: MediaSlot, path: string): void => {
    checkProvenance(slot.provenance, `${path}.provenance`, slot.audience === 'student')
    const target = slot.target
    const exists = target.kind === 'content_set' ? target.id === contentSet.id : target.kind === 'group' ? groups.has(target.id) : target.kind === 'guidance' ? guidance.has(target.id) : notes.has(target.id)
    if (!exists) fail(`${path}.target`, 'unknown_media_target', 'Media target must resolve in this draft.')
    if (slot.audience === 'student' && target.kind === 'teacher_notes') fail(`${path}.target`, 'private_media_target', 'Student media cannot target private teacher notes.')
    if (slot.segment && slot.segment.endMs <= slot.segment.startMs) fail(`${path}.segment`, 'invalid_media_segment', 'Media segment end must follow its start.')
    if (slot.purpose === 'exam_listening' && target.kind === 'group' && groups.get(target.id)?.role !== 'exam') fail(`${path}.purpose`, 'media_role_mismatch', 'Exam listening media must target an exam group.')
    if (slot.purpose === 'training_audio' && target.kind === 'group' && groups.get(target.id)?.role !== 'training') fail(`${path}.purpose`, 'media_role_mismatch', 'Training audio must target a training group.')
  }
  content.mediaSlots.forEach((slot, index) => checkMedia(slot, `$.content.mediaSlots[${index}]`))
  solutions.mediaSlots.forEach((slot, index) => checkMedia(slot, `$.solutions.mediaSlots[${index}]`))
  const pageRoles = new Map<string, Set<string>>()
  references.forEach(({ ref }) => {
    const key = JSON.stringify([ref.sourceId, ref.pdfPage])
    const roles = pageRoles.get(key) ?? new Set<string>()
    roles.add(ref.role)
    pageRoles.set(key, roles)
  })
  references.forEach(({ ref, path, student }) => {
    const roles = pageRoles.get(JSON.stringify([ref.sourceId, ref.pdfPage]))
    if (student && !ref.region && roles && (roles.has('teacher_notes') || roles.has('solution'))) fail(`${path}.region`, 'mixed_role_crop_required', 'A student reference to a page containing private material requires an explicit crop.')
  })
}

function validateAnswer(solution: Solution, question: Question, group: QuestionGroup, path: string, issues: ValidationIssue[], recordUse: (ids: readonly string[]) => void): void {
  if (solution.answerType === 'multiple_choice' && question.answerType === 'multiple_choice') {
    const seen = new Set<string>()
    for (const set of solution.acceptedOptionSets) {
      const signature = [...set].sort().join('|')
      if (set.length !== question.selectionCount || new Set(set).size !== set.length || set.some(id => !question.options.some(option => option.id === id)) || seen.has(signature)) issue(issues, path, 'invalid_answer_set', 'Multiple-choice alternatives must contain the required number of distinct valid options.')
      seen.add(signature)
    }
  }
  if (solution.answerType === 'single_choice' && question.answerType === 'single_choice') {
    if (!question.options.some(option => option.id === solution.correctOptionId)) issue(issues, `${path}.correctOptionId`, 'unknown_option', 'Correct answer must identify an option of this question.')
  }
  if (solution.answerType === 'gap_fill' && question.answerType === 'gap_fill') {
    const signatures = new Set<string>()
    const pool = group.optionPools.find(item => item.id === question.optionPoolId)
    solution.acceptedAnswerSets.forEach((answerSet, index) => {
      const setPath = `${path}.acceptedAnswerSets[${index}]`
      unique(answerSet.map(answer => answer.gapId), setPath, issues)
      if (answerSet.length !== question.gaps.length || answerSet.some((answer, gapIndex) => answer.gapId !== question.gaps[gapIndex]?.id)) {
        issue(issues, setPath, 'incomplete_answer_set', 'Each authored alternative must cover every gap in declared gap order.')
      }
      answerSet.forEach((answer, gapIndex) => {
        const gap = question.gaps[gapIndex]
        if (gap?.maxWords !== null && gap?.maxWords !== undefined && answer.value.trim().split(/\s+/u).length > gap.maxWords) issue(issues, `${setPath}[${gapIndex}].value`, 'answer_word_limit', 'Answer exceeds the authored word limit for its gap.')
        if (pool && !pool.options.some(option => option.label.trim().toLowerCase() === answer.value.trim().toLowerCase())) issue(issues, `${setPath}[${gapIndex}].value`, 'unknown_option', 'Answer text must match a label from its option pool after trimming and case folding.')
      })
      // Do not create per-gap alternatives: the complete ordered tuple is the unit of validation.
      const normalized = answerSet.map(answer => answer.value.trim().toLowerCase())
      const signature = JSON.stringify(question.answerOrder === 'any' ? [...normalized].sort() : normalized)
      if (signatures.has(signature)) issue(issues, setPath, 'duplicate_answer_set', 'Complete answer combinations must be distinct after the declared normalization.')
      signatures.add(signature)
      if (pool && !pool.allowReuse) {
        const unambiguousIds = answerSet.map(answer => {
          const options = pool.options.filter(option => option.label.trim().toLowerCase() === answer.value.trim().toLowerCase())
          return options.length === 1 ? options[0].id : null
        }).filter((optionId): optionId is string => optionId !== null)
        if (new Set(unambiguousIds).size !== unambiguousIds.length) issue(issues, setPath, 'pool_reuse', 'This option pool does not permit repeated options within an answer combination.')
        if (solution.acceptedAnswerSets.length === 1) recordUse(unambiguousIds)
      }
    })
  }
  if (solution.answerType === 'matching' && question.answerType === 'matching') {
    const pool = group.optionPools.find(item => item.id === question.optionPoolId)
    const signatures = new Set<string>()
    solution.acceptedMatches.forEach((matches, index) => {
      const matchPath = `${path}.acceptedMatches[${index}]`
      unique(matches.map(match => match.itemId), matchPath, issues)
      if (matches.length !== question.items.length || question.items.some(item => !matches.some(match => match.itemId === item.id))) issue(issues, matchPath, 'incomplete_matching_set', 'Each alternative must match every item exactly once.')
      matches.forEach((match, matchIndex) => {
        if (!pool?.options.some(option => option.id === match.optionId)) issue(issues, `${matchPath}[${matchIndex}].optionId`, 'unknown_option', 'Matched option must resolve in the containing group’s pool.')
      })
      if (pool && !pool.allowReuse && new Set(matches.map(match => match.optionId)).size !== matches.length) issue(issues, matchPath, 'pool_reuse', 'This option pool does not permit repeated options within an answer combination.')
      const signature = JSON.stringify(question.items.map(item => matches.find(match => match.itemId === item.id)?.optionId))
      if (signatures.has(signature)) issue(issues, matchPath, 'duplicate_answer_set', 'Complete matching combinations must be distinct.')
      signatures.add(signature)
      if (solution.acceptedMatches.length === 1) recordUse(matches.map(match => match.optionId))
    })
  }
}
