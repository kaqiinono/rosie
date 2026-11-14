import { describe, expect, it } from 'vitest'
import { KET_READING_EXAMPLE, KET_READING_EXAMPLE_SET } from '../../../packages/exams/examples/ket-reading-part1'
import { KET_READING_EXAMPLE_SOLUTION } from '../../../packages/exams/examples/ket-reading-part1.solution'
import { describeExamDraftReadiness, validateExamDraft, type ExamDraftInput } from '../../../packages/exams/src/validation'

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T
type Draft = Mutable<ExamDraftInput>

function fixture(): Draft {
  return structuredClone({ contentSet: KET_READING_EXAMPLE_SET, content: KET_READING_EXAMPLE, solutions: KET_READING_EXAMPLE_SOLUTION }) as unknown as Draft
}

function codes(input: unknown): string[] {
  const result = validateExamDraft(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : result.issues.map(issue => issue.code)
}

function gapFixture(): Draft {
  const draft = fixture()
  const group = draft.content.groups[0]
  const original = group.questions[0]
  const questionId = `${draft.contentSet.source.id}:test-1:exam:reading_writing:part-5:1` as const
  group.partNumber = 5
  group.questions = [{
    id: questionId,
    location: { ...original.location, partNumber: 5 },
    answerType: 'gap_fill', prompt: [],
    gaps: [{ id: 'first', label: 'First gap', maxWords: 1 }, { id: 'second', label: 'Second gap', maxWords: 1 }],
    answerOrder: 'fixed', scoring: { kind: 'objective', maxPoints: 1 },
    classification: { ...original.classification, questionTypeId: 'open_cloze' },
    provenance: original.provenance,
  }]
  const solution = draft.solutions.solutions[0]
  draft.solutions.solutions = [{
    id: solution.id, role: 'solution', questionId, answerType: 'gap_fill',
    provenance: solution.provenance, explanations: solution.explanations, evidence: solution.evidence, distractors: [],
    normalization: { trim: true, ignoreCase: true },
    acceptedAnswerSets: [
      [{ gapId: 'first', value: 'is' }, { gapId: 'second', value: 'he' }],
      [{ gapId: 'first', value: 'are' }, { gapId: 'second', value: 'they' }],
    ],
  }]
  return draft
}

function matchingFixture(): Draft {
  const draft = fixture()
  const group = draft.content.groups[0]
  const original = group.questions[0]
  const questionId = `${draft.contentSet.source.id}:test-1:exam:reading_writing:part-2:1` as const
  group.partNumber = 2
  group.optionPools = [{ id: 'pool', options: [{ id: 'A', label: 'First' }, { id: 'B', label: 'Second' }], allowReuse: false }]
  group.questions = [{
    id: questionId, location: { ...original.location, partNumber: 2 }, answerType: 'matching',
    prompt: [], items: [{ id: 'one', prompt: [] }, { id: 'two', prompt: [] }], optionPoolId: 'pool',
    scoring: { kind: 'objective', maxPoints: 1 },
    classification: { ...original.classification, questionTypeId: 'multiple_text_matching' }, provenance: original.provenance,
  }]
  const solution = draft.solutions.solutions[0]
  draft.solutions.solutions = [{
    id: solution.id, role: 'solution', questionId, answerType: 'matching', provenance: solution.provenance,
    explanations: solution.explanations, evidence: solution.evidence, distractors: [],
    acceptedMatches: [[{ itemId: 'one', optionId: 'A' }, { itemId: 'two', optionId: 'B' }]],
  }]
  return draft
}

describe('exam draft structure and authoring readiness', () => {
  it('accepts the existing pending sample without granting exam readiness', () => {
    const result = validateExamDraft(fixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const readiness = describeExamDraftReadiness(result.value)
    expect(readiness.exam.some(issue => issue.code === 'review_pending')).toBe(true)
    expect(readiness.exam.some(issue => issue.code === 'section_coverage_incomplete')).toBe(true)
    expect(readiness.explanations.some(issue => issue.code === 'review_pending')).toBe(true)
    expect(readiness).not.toHaveProperty('canPublish')
  })

  it('allows incomplete drafts with no solutions or question groups', () => {
    const draft = fixture()
    draft.solutions.solutions = []
    const result = validateExamDraft(draft)
    expect(result.ok).toBe(true)
    if (result.ok) expect(describeExamDraftReadiness(result.value).exam.some(issue => issue.code === 'answer_missing')).toBe(true)
    draft.content.groups = []
    draft.content.materials = []
    expect(validateExamDraft(draft).ok).toBe(true)
    expect(describeExamDraftReadiness(draft).exam.some(issue => issue.code === 'groups_missing')).toBe(true)
  })

  it('reports objective evidence gaps separately from explanation text', () => {
    const draft = fixture()
    draft.solutions.solutions[0].evidence = []
    expect(validateExamDraft(draft).ok).toBe(true)
    const readiness = describeExamDraftReadiness(draft)
    expect(readiness.explanations.some(issue => issue.code === 'evidence_missing')).toBe(true)
    expect(readiness.explanations.some(issue => issue.code === 'explanation_missing')).toBe(false)
  })

  it('requires both writing samples and task guidance in explanation readiness', () => {
    const draft = fixture()
    const group = draft.content.groups[0]
    const original = group.questions[0]
    const questionId = `${draft.contentSet.source.id}:test-1:exam:reading_writing:part-6:1` as const
    group.partNumber = 6
    group.questions = [{
      id: questionId, location: { ...original.location, partNumber: 6 }, answerType: 'writing',
      prompt: [], minimumWords: null, scoring: { kind: 'manual', rubricId: 'ket-writing-v1' },
      classification: { ...original.classification, domain: 'writing', questionTypeId: 'email_note' }, provenance: original.provenance,
    }]
    const sourceSolution = draft.solutions.solutions[0]
    draft.solutions.solutions = [{
      id: sourceSolution.id, role: 'solution', questionId, answerType: 'writing', provenance: sourceSolution.provenance,
      explanations: [], evidence: [], distractors: [], samples: [], taskGuidance: sourceSolution.explanations,
    }]
    expect(validateExamDraft(draft).ok).toBe(true)
    expect(describeExamDraftReadiness(draft).explanations.some(issue => issue.code === 'writing_sample_missing')).toBe(true)
    const solution = draft.solutions.solutions[0]
    if (solution.answerType !== 'writing') throw new Error('Expected writing solution')
    solution.samples = [{ id: 'sample', text: 'An authored sample response.', provenance: solution.provenance, originalScore: null, originalComments: [], supplementaryComments: [] }]
    solution.taskGuidance = []
    expect(validateExamDraft(draft).ok).toBe(true)
    expect(describeExamDraftReadiness(draft).explanations.some(issue => issue.code === 'writing_guidance_missing')).toBe(true)
    expect(describeExamDraftReadiness(draft).explanations.some(issue => issue.code === 'writing_sample_missing')).toBe(false)
  })

  it('preserves empty printed table cells and email subjects', () => {
    const draft = fixture()
    draft.content.materials[0].blocks.push(
      { id: 'table', kind: 'table', headers: ['', 'Name'], rows: [['', '']] },
      { id: 'email', kind: 'email', from: 'A', to: 'B', subject: '', body: ['Please reply.'] },
    )
    expect(validateExamDraft(draft).ok).toBe(true)
  })

  it('rejects extra answer fields at every public content level', () => {
    const draft = fixture()
    expect(codes({ ...draft, content: { ...draft.content, answers: ['secret'] } })).toContain('unknown_field')
    expect(codes({ ...draft, content: { ...draft.content, groups: draft.content.groups.map(group => ({ ...group, questions: group.questions.map(question => ({ ...question, correctOptionId: 'B' })) })) } })).toContain('unknown_field')
  })

  it('rejects publication and all client-authored approval markers', () => {
    const draft = fixture()
    expect(codes({ ...draft, content: { ...draft.content, status: 'published' } })).toContain('invalid_enum')
    const approved = { status: 'approved', reviewedBy: 'pretend-reviewer', reviewedAt: '2026-11-13T00:00:00Z' }
    expect(codes({ ...draft, content: { ...draft.content, readiness: { ...draft.content.readiness, exam: approved } } })).toContain('review_not_authorized')
    draft.content.materials[0].provenance.review = { status: 'approved', reviewedBy: 'pretend-reviewer', reviewedAt: '2026-11-13T00:00:00Z' }
    expect(codes(draft)).toContain('review_not_authorized')
  })

  it('keeps source editions and test/page identities independent', () => {
    const draft = fixture()
    draft.content.materials[0].provenance.sources[0].sourceId = 'another-book'
    expect(codes(draft)).toContain('source_mismatch')
    const changedLocation = fixture()
    changedLocation.content.groups[0].questions[0].location.testNumber = 2
    expect(codes(changedLocation)).toEqual(expect.arrayContaining(['source_mismatch', 'question_id_mismatch']))
    const zeroPage = fixture()
    zeroPage.content.materials[0].provenance.sources[0].pdfPage = 0
    expect(codes(zeroPage)).toContain('invalid_number')
  })

  it('rejects crops outside a source page and requires crops on mixed private pages', () => {
    const draft = fixture()
    draft.content.materials[0].provenance.sources[0].region = { x: 0.9, y: 0, width: 0.2, height: 1 }
    expect(codes(draft)).toContain('crop_out_of_bounds')
    const mixedPage = fixture()
    mixedPage.solutions.solutions[0].provenance.sources[0].pdfPage = 9
    expect(codes(mixedPage)).toContain('mixed_role_crop_required')
  })

  it('rejects broken material, solution and revision references', () => {
    const draft = fixture()
    draft.content.groups[0].materialIds = ['missing-material']
    expect(codes(draft)).toContain('unknown_material')
    const missingQuestion = fixture()
    missingQuestion.solutions.solutions[0].questionId = 'source:test-1:exam:reading_writing:part-1:9'
    expect(codes(missingQuestion)).toContain('unknown_question')
    const wrongRevision = fixture()
    wrongRevision.solutions.contentRevisionId = 'other-revision'
    expect(codes(wrongRevision)).toContain('reference_mismatch')
  })

  it('rejects duplicate entity IDs, repeated questions and split shared materials', () => {
    const draft = fixture()
    draft.content.materials.push(structuredClone(draft.content.materials[0]))
    expect(codes(draft)).toContain('duplicate_id')
    const duplicateQuestion = fixture()
    duplicateQuestion.content.groups[0].questions.push(structuredClone(duplicateQuestion.content.groups[0].questions[0]))
    expect(codes(duplicateQuestion)).toContain('duplicate_id')
    const splitMaterial = fixture()
    splitMaterial.content.groups.push({ ...structuredClone(splitMaterial.content.groups[0]), id: 'second-group', questions: [] })
    expect(codes(splitMaterial)).toContain('split_material')
  })

  it('rejects single-choice answers outside the question options without echoing the value', () => {
    const draft = fixture()
    const solution = draft.solutions.solutions[0]
    if (solution.answerType !== 'single_choice') throw new Error('Expected sample choice solution')
    solution.correctOptionId = 'not-an-option'
    const result = validateExamDraft(draft)
    expect(codes(draft)).toContain('unknown_option')
    expect(JSON.stringify(result)).not.toContain('not-an-option')
  })

  it('preserves correlated complete gap alternatives and rejects incomplete tuples', () => {
    const draft = gapFixture()
    const result = validateExamDraft(draft)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const solution = result.value.solutions.solutions[0]
      if (solution.answerType !== 'gap_fill') throw new Error('Expected gap solution')
      expect(solution.acceptedAnswerSets).toHaveLength(2)
      expect(solution.acceptedAnswerSets).toEqual(draft.solutions.solutions[0].answerType === 'gap_fill' ? draft.solutions.solutions[0].acceptedAnswerSets : [])
      expect(solution.acceptedAnswerSets).not.toContainEqual([{ gapId: 'first', value: 'is' }, { gapId: 'second', value: 'they' }])
    }
    const solution = draft.solutions.solutions[0]
    if (solution.answerType !== 'gap_fill') throw new Error('Expected gap solution')
    solution.acceptedAnswerSets[0].pop()
    expect(codes(draft)).toContain('incomplete_answer_set')
  })

  it('matches gap answers to option text, not option IDs', () => {
    const draft = gapFixture()
    const group = draft.content.groups[0]
    const question = group.questions[0]
    if (question.answerType !== 'gap_fill') throw new Error('Expected gap question')
    question.optionPoolId = 'words'
    group.optionPools = [{ id: 'words', allowReuse: true, options: [{ id: 'A', label: 'IS' }, { id: 'B', label: 'he' }, { id: 'C', label: 'are' }, { id: 'D', label: 'they' }] }]
    expect(validateExamDraft(draft).ok).toBe(true)
    const solution = draft.solutions.solutions[0]
    if (solution.answerType !== 'gap_fill') throw new Error('Expected gap solution')
    solution.acceptedAnswerSets[0][0].value = 'A'
    expect(codes(draft)).toContain('unknown_option')
  })

  it('enforces complete matching coverage and within-combination reuse rules', () => {
    const draft = matchingFixture()
    expect(validateExamDraft(draft).ok).toBe(true)
    const solution = draft.solutions.solutions[0]
    if (solution.answerType !== 'matching') throw new Error('Expected matching solution')
    solution.acceptedMatches[0][1].optionId = 'A'
    expect(codes(draft)).toContain('pool_reuse')
    draft.content.groups[0].optionPools[0].allowReuse = true
    expect(validateExamDraft(draft).ok).toBe(true)
    solution.acceptedMatches[0].pop()
    expect(codes(draft)).toContain('incomplete_matching_set')
  })

  it('reports cross-question alternative pool conflicts for review without inferring joint combinations', () => {
    const draft = matchingFixture()
    const group = draft.content.groups[0]
    const question = group.questions[0]
    const solution = draft.solutions.solutions[0]
    if (question.answerType !== 'matching' || solution.answerType !== 'matching') throw new Error('Expected matching fixture')
    question.items = [{ id: 'one', prompt: [] }]
    solution.acceptedMatches = [[{ itemId: 'one', optionId: 'A' }], [{ itemId: 'one', optionId: 'B' }]]
    const secondId = `${draft.contentSet.source.id}:test-1:exam:reading_writing:part-2:2` as const
    group.questions.push({ ...structuredClone(question), id: secondId, location: { ...question.location, questionNumber: '2' } })
    draft.solutions.solutions.push({ ...structuredClone(solution), id: 'second-solution', questionId: secondId })
    expect(validateExamDraft(draft).ok).toBe(true)
    expect(describeExamDraftReadiness(draft).exam.some(issue => issue.code === 'pool_combinations_review_required')).toBe(true)
    solution.acceptedMatches = [[{ itemId: 'one', optionId: 'A' }]]
    const secondSolution = draft.solutions.solutions[1]
    if (secondSolution.answerType !== 'matching') throw new Error('Expected matching solution')
    secondSolution.acceptedMatches = [[{ itemId: 'one', optionId: 'A' }]]
    expect(codes(draft)).toContain('pool_reuse')
  })

  it('rejects private media in student revisions and references', () => {
    const draft = fixture()
    const privateSlot = {
      id: 'private-image', audience: 'review' as const, purpose: 'solution_image' as const,
      target: { kind: 'group' as const, id: draft.content.groups[0].id }, sourceTrackLabel: null,
      required: false, segment: null, playback: null, provenance: draft.solutions.solutions[0].provenance,
    }
    expect(codes({ ...draft, content: { ...draft.content, mediaSlots: [privateSlot] } })).toContain('invalid_enum')
    draft.solutions.mediaSlots = [privateSlot]
    draft.content.materials[0].blocks.push({ id: 'image', kind: 'image', mediaSlotId: privateSlot.id, alt: 'Image' })
    expect(codes(draft)).toContain('private_media')
  })

  it('rejects nonexisting media targets and wrong student source roles', () => {
    const draft = fixture()
    draft.content.mediaSlots = [{
      id: 'image', audience: 'student', purpose: 'question_image', target: { kind: 'group', id: 'missing-group' },
      sourceTrackLabel: null, required: true, segment: null, playback: null,
      provenance: draft.solutions.solutions[0].provenance,
    }]
    expect(codes(draft)).toEqual(expect.arrayContaining(['unknown_media_target', 'private_source']))
  })

  it('checks vocabulary UUID, full snapshot and UTF-16 block range', () => {
    const draft = fixture()
    draft.content.vocabularyLinks = [{
      id: 'word-link', wordEntryId: '3cb4f547-7f10-4f4a-8ae8-b76701b91bce',
      sourceSnapshot: { stage: '4A', unit: '1', lesson: '1', word: 'bag' },
      questionIds: [draft.content.groups[0].questions[0].id], materialId: draft.content.materials[0].id,
      blockId: 'title', matchedForm: 'bag', contextMeaning: '包', sentence: 'Found: blue sports bag',
      textRange: { start: 19, end: 22 }, role: 'key', review: { status: 'pending' },
    }]
    // The title is 22 UTF-16 code units; bag occupies the final three.
    expect(validateExamDraft(draft).ok).toBe(true)
    draft.content.vocabularyLinks[0].wordEntryId = 'bag'
    expect(codes(draft)).toContain('invalid_uuid')
    draft.content.vocabularyLinks[0].wordEntryId = '3cb4f547-7f10-4f4a-8ae8-b76701b91bce'
    draft.content.vocabularyLinks[0].sourceSnapshot.lesson = ''
    expect(codes(draft)).toContain('invalid_string')
  })

  it('bounds adversarial input and rejects schema versions outside this contract', () => {
    const draft = fixture()
    expect(codes({ ...draft, content: { ...draft.content, schemaVersion: 2 } })).toContain('invalid_enum')
    const cyclic: { next?: unknown } = {}
    cyclic.next = cyclic
    expect(codes(cyclic)).toContain('invalid_json')
    expect(codes({ ...draft, contentSet: { ...draft.contentSet, title: 'x'.repeat(50_001) } })).toContain('input_limit')
  })
})
