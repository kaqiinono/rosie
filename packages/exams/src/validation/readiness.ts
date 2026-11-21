import { resolveExamTemplate } from '../templates/examTemplates'
import type { ContentProvenance, ContentReview } from '../types/content'
import type { Explanation, Solution } from '../types/solutions'
import { issue as addIssue, type ExamDraftInput, type ValidationIssue } from './contracts'

const publicationChecks = new Set([
  'unknown_template', 'groups_missing', 'material_empty', 'questions_missing', 'ambiguous_pool_labels',
  'answer_missing', 'section_coverage_incomplete', 'part_missing', 'playback_unconfigured', 'listening_media_missing',
])

/** Authoring gaps only. Empty lists do not authorize publication, media access or an exam. */
export function describeExamDraftReadiness(draft: ExamDraftInput, publication = false): { exam: ValidationIssue[]; explanations: ValidationIssue[] } {
  function issue(issues: ValidationIssue[], path: string, code: string, message: string) {
    if (!publication || publicationChecks.has(code)) addIssue(issues, path, code, message)
  }
  const exam: ValidationIssue[] = []
  const explanations: ValidationIssue[] = []
  const { content, solutions, contentSet } = draft
  const template = resolveExamTemplate(contentSet.template)
  if (!template) {
    issue(exam, '$.contentSet.template', 'unknown_template', 'Only registered template versions may be referenced.')
    return { exam, explanations }
  }
  const solutionMap = new Map(solutions.solutions.map(solution => [solution.questionId, solution]))
  const review = (value: ContentReview, path: string, target: ValidationIssue[]): void => {
    if (value.status !== 'approved') issue(target, path, value.status === 'blocked' ? 'review_blocked' : 'review_pending', 'Content still requires an authorized source review.')
  }
  const provenance = (value: ContentProvenance, path: string, target: ValidationIssue[]): void => {
    review(value.review, `${path}.review`, target)
    if (value.origin === 'source' && value.sources.length === 0) issue(target, `${path}.sources`, 'source_missing', 'Source-derived content needs an explicit source page reference.')
  }
  const explanationReviews = (values: readonly Explanation[], path: string): void => values.forEach((value, index) => provenance(value.provenance, `${path}[${index}].provenance`, explanations))
  if (!content.groups.length) issue(exam, '$.content.groups', 'groups_missing', 'Draft has no complete question groups yet.')
  if (content.readiness.exam.status === 'blocked') issue(exam, '$.content.readiness.exam', 'review_blocked', 'Exam preparation is explicitly blocked.')
  if (content.readiness.explanations.status === 'blocked') issue(explanations, '$.content.readiness.explanations', 'review_blocked', 'Explanation preparation is explicitly blocked.')

  content.materials.forEach((material, index) => {
    const path = `$.content.materials[${index}]`
    provenance(material.provenance, `${path}.provenance`, exam)
    if (!material.blocks.length) issue(exam, `${path}.blocks`, 'material_empty', 'Material has no authored blocks yet.')
    if (!content.groups.some(group => group.materialIds.includes(material.id))) issue(exam, path, 'material_ungrouped', 'Material still needs membership in its complete question group.')
  })
  content.groups.forEach((group, groupIndex) => {
    const path = `$.content.groups[${groupIndex}]`
    provenance(group.provenance, `${path}.provenance`, exam)
    if (!group.questions.length) issue(exam, `${path}.questions`, 'questions_missing', 'Group has no questions yet.')
    group.optionPools.forEach((pool, poolIndex) => {
      const labels = pool.options.map(option => option.label.trim().toLowerCase())
      if (new Set(labels).size !== labels.length && group.questions.some(question => question.answerType === 'gap_fill' && question.optionPoolId === pool.id)) {
        issue(exam, `${path}.optionPools[${poolIndex}]`, 'ambiguous_pool_labels', 'Identical option labels need review before text answers can identify pool options unambiguously.')
      }
      if (pool.allowReuse) return
      const usages = group.questions.flatMap(question => {
        if ((question.answerType !== 'matching' && question.answerType !== 'gap_fill') || question.optionPoolId !== pool.id || question.scoring.kind === 'example') return []
        const solution = solutionMap.get(question.id)
        if (solution?.answerType === 'matching') return [{ questionId: question.id, alternatives: solution.acceptedMatches.length, ids: new Set(solution.acceptedMatches.flatMap(matches => matches.map(match => match.optionId))) }]
        if (solution?.answerType === 'gap_fill') return [{ questionId: question.id, alternatives: solution.acceptedAnswerSets.length, ids: new Set(solution.acceptedAnswerSets.flatMap(answers => answers.flatMap(answer => pool.options.filter(option => option.label.trim().toLowerCase() === answer.value.trim().toLowerCase()).map(option => option.id)))) }]
        return []
      })
      const needsReview = usages.some((usage, index) => usages.slice(index + 1).some(other => (usage.alternatives > 1 || other.alternatives > 1) && [...usage.ids].some(id => other.ids.has(id))))
      if (needsReview) issue(exam, `${path}.optionPools[${poolIndex}]`, 'pool_combinations_review_required', 'Shared non-reusable pool alternatives need joint review; no cross-question combinations have been inferred.')
    })
    group.questions.forEach((question, questionIndex) => {
      const questionPath = `${path}.questions[${questionIndex}]`
      provenance(question.provenance, `${questionPath}.provenance`, exam)
      review(question.classification.review, `${questionPath}.classification.review`, exam)
      const solution = solutionMap.get(question.id)
      if ((!publication || question.scoring.kind !== 'example') && (!solution || !hasAnswer(solution))) issue(exam, questionPath, 'answer_missing', 'Question still needs its authored answer or manual review guidance.')
      if (!solution || (solution.answerType !== 'writing' && !hasExplanation(solution))) issue(explanations, questionPath, 'explanation_missing', 'Question still needs reviewed explanation content.')
      if (solution && ['single_choice', 'multiple_choice', 'gap_fill', 'matching'].includes(solution.answerType) && !solution.evidence.length) issue(explanations, questionPath, 'evidence_missing', 'Objective explanation needs source-referenced supporting evidence.')
      if (question.answerType === 'writing') {
        if (solution?.answerType !== 'writing' || !solution.samples.length) issue(explanations, questionPath, 'writing_sample_missing', 'Writing explanation needs a source-reviewed sample response.')
        if (solution?.answerType !== 'writing' || !solution.taskGuidance.length) issue(explanations, questionPath, 'writing_guidance_missing', 'Writing explanation needs task-specific guidance in addition to a sample response.')
      }
      if (question.scoring.kind === 'manual') {
        const rubricId = question.scoring.rubricId
        const rubric = template.rubrics.find(value => value.id === rubricId)
        if (!rubric || rubric.dimensions.some(dimension => dimension.range === null)) issue(exam, `${questionPath}.scoring`, 'rubric_incomplete', 'Manual rubric source ranges still need review.')
        issue(exam, `${questionPath}.scoring`, 'rubric_descriptors_unverified', 'Source rubric band descriptors and scoring workflow have not been verified by this draft validator.')
      }
    })
  })
  if (contentSet.kind !== 'training_unit') {
    for (const section of template.sections) {
      const groups = content.groups.filter(group => group.role === 'exam' && group.sectionId === section.id)
      const questions = groups.flatMap(group => group.questions)
      const objectiveCount = questions.filter(question => question.scoring.kind === 'objective').length
      const writingCount = groups.reduce((count, group) => count + (group.writingChoice ? 1
        : group.questions.filter(question => question.answerType === 'writing' && question.scoring.kind === 'manual').length), 0)
      const speakingParts = new Set(questions.filter(question => question.answerType === 'speaking' && question.scoring.kind === 'manual').map(question => question.location.partNumber)).size
      if (objectiveCount !== section.objectiveQuestionCount || writingCount !== section.writingTaskCount || speakingParts !== section.speakingPartCount) issue(exam, '$.content.groups', 'section_coverage_incomplete', 'Exam section question/task coverage differs from the registered template.')
      for (const part of section.parts) {
        if (!groups.some(group => group.partNumber === part.number && group.questions.length > 0)) issue(exam, '$.content.groups', 'part_missing', 'An exam Part has no authored question group yet.')
      }
    }
  }
  content.guidance.forEach((item, index) => provenance(item.provenance, `$.content.guidance[${index}].provenance`, exam))
  content.vocabularyLinks.forEach((link, index) => {
    if (!link.matchSource || link.review.status === 'blocked') review(link.review, `$.content.vocabularyLinks[${index}].review`, exam)
  })
  solutions.solutions.forEach((solution, index) => {
    const path = `$.solutions.solutions[${index}]`
    provenance(solution.provenance, `${path}.provenance`, exam)
    provenance(solution.provenance, `${path}.provenance`, explanations)
    explanationReviews(solution.explanations, `${path}.explanations`)
    solution.distractors.forEach((distractor, distractorIndex) => provenance(distractor.explanation.provenance, `${path}.distractors[${distractorIndex}].explanation.provenance`, explanations))
    if (solution.answerType === 'writing') {
      explanationReviews(solution.taskGuidance, `${path}.taskGuidance`)
      solution.samples.forEach((sample, sampleIndex) => {
        const samplePath = `${path}.samples[${sampleIndex}]`
        provenance(sample.provenance, `${samplePath}.provenance`, explanations)
        explanationReviews(sample.originalComments, `${samplePath}.originalComments`)
        explanationReviews(sample.supplementaryComments, `${samplePath}.supplementaryComments`)
      })
    }
    if (solution.answerType === 'speaking') explanationReviews(solution.reviewGuidance, `${path}.reviewGuidance`)
    if (solution.answerType === 'self_check') explanationReviews(solution.guidance, `${path}.guidance`)
  })
  solutions.teacherNotes.forEach((note, index) => provenance(note.provenance, `$.solutions.teacherNotes[${index}].provenance`, explanations))
  const checkMedia = (slot: (typeof content.mediaSlots)[number] | (typeof solutions.mediaSlots)[number], path: string, target: ValidationIssue[]): void => {
    provenance(slot.provenance, `${path}.provenance`, target)
    if (!slot.required) return
    issue(target, path, 'media_availability_unverified', 'Required media file, authorization and binding availability have not been verified.')
    if (!content.mediaBindingRevisionId) issue(target, '$.content.mediaBindingRevisionId', 'media_binding_missing', 'Required media needs a reviewed binding revision.')
    const audio = ['exam_listening', 'training_audio', 'speaking_example', 'examiner_audio'].includes(slot.purpose)
    if (audio && !slot.playback) issue(target, `${path}.playback`, 'playback_unconfigured', 'Required audio repetitions and waits still need review.')
  }
  content.mediaSlots.forEach((slot, index) => checkMedia(slot, `$.content.mediaSlots[${index}]`, exam))
  solutions.mediaSlots.forEach((slot, index) => checkMedia(slot, `$.solutions.mediaSlots[${index}]`, explanations))
  if (content.groups.some(group => group.role === 'exam' && group.sectionId === 'listening') && !content.mediaSlots.some(slot => slot.purpose === 'exam_listening' && slot.required)) issue(exam, '$.content.mediaSlots', 'listening_media_missing', 'Listening content needs an authored and reviewed listening program.')
  return { exam, explanations }
}

function hasAnswer(solution: Solution): boolean {
  switch (solution.answerType) {
    case 'single_choice': return true
    case 'multiple_choice': return solution.acceptedOptionSets.length > 0
    case 'gap_fill': return solution.acceptedAnswerSets.length > 0
    case 'matching': return solution.acceptedMatches.length > 0
    case 'writing': return solution.taskGuidance.length > 0 || solution.samples.length > 0
    case 'speaking': return solution.reviewGuidance.length > 0
    case 'self_check': return solution.guidance.length > 0
  }
}

function hasExplanation(solution: Solution): boolean {
  if (solution.explanations.length) return true
  if (solution.answerType === 'writing') return solution.taskGuidance.length > 0 || solution.samples.some(sample => sample.originalComments.length > 0 || sample.supplementaryComments.length > 0)
  if (solution.answerType === 'speaking') return solution.reviewGuidance.length > 0
  if (solution.answerType === 'self_check') return solution.guidance.length > 0
  return false
}
