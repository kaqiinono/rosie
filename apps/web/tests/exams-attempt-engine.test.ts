// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { ContentProvenance, QuestionGroup, QuestionId } from '../../../packages/exams/src/types/content'
import type { GapFillQuestion, MatchingQuestion, Question, SingleChoiceQuestion, SpeakingQuestion, WritingQuestion } from '../../../packages/exams/src/types/questions'
import type { Solution } from '../../../packages/exams/src/types/solutions'
import type { ExamAnswer, ExamAttemptState } from '../../../packages/exams/src/types/attempts'
import type { ExamDraftInput } from '../../../packages/exams/src/validation/contracts'
import { applyExamOperation, newExamAttempt, parseExamAnswer, scoreExamQuestion } from '../src/lib/exams/attemptEngine'

vi.mock('server-only', () => ({}))

// Synthetic data only: no source books, media, environment or database access.
const provenance: ContentProvenance = { origin: 'supplement', sources: [], review: { status: 'pending' } }
const at = (seconds: number) => new Date(Date.parse('2026-11-13T00:00:00.000Z') + seconds * 1000).toISOString()
function base(number: string, sectionId = 'reading_writing', partNumber = 1) {
  return {
    id: `synthetic:test-1:exam:${sectionId}:part-${partNumber}:${number}` as QuestionId,
    location: { sourceId: 'synthetic', testNumber: 1, role: 'exam' as const, sectionId, partNumber, questionNumber: number },
    prompt: [], provenance,
    classification: { domain: 'reading' as const, questionTypeId: 'synthetic', primarySkillId: 'detail', knowledgePointIds: [], topicIds: [], review: { status: 'pending' as const } },
  }
}
function choice(number = '1', sectionId = 'reading_writing'): SingleChoiceQuestion {
  return { ...base(number, sectionId), answerType: 'single_choice', options: [{ id: 'A', label: 'One' }, { id: 'B', label: 'Two' }], scoring: { kind: 'objective', maxPoints: 1 } }
}
function solutionBase(question: Question) {
  return { id: `${question.id}:solution`, role: 'solution' as const, questionId: question.id, provenance, explanations: [], evidence: [], distractors: [] }
}
function choiceKey(question: SingleChoiceQuestion): Solution {
  return { ...solutionBase(question), answerType: 'single_choice', correctOptionId: 'A' }
}
function group(id: string, questions: Question[]): QuestionGroup {
  return { id, role: 'exam', sectionId: questions[0].location.sectionId, partNumber: questions[0].location.partNumber,
    instructions: [], materialIds: [`${id}:material`], optionPools: [], questions, provenance }
}
function fixture() {
  const first = choice('1'), second = choice('2'), listening = choice('1', 'listening')
  const example: SingleChoiceQuestion = { ...choice('example-0'), scoring: { kind: 'example', points: 0 } }
  const writing: WritingQuestion = { ...base('31', 'reading_writing', 6), answerType: 'writing', minimumWords: 25, scoring: { kind: 'manual', rubricId: 'ket-writing-v1' } }
  const speaking: SpeakingQuestion = { ...base('task', 'speaking'), answerType: 'speaking', scoring: { kind: 'manual', rubricId: 'ket-speaking-v1' } }
  const groups = [group('reading', [first, second, example]), group('writing', [writing]), group('listening', [listening]), group('speaking', [speaking])]
  const draft: ExamDraftInput = {
    contentSet: { id: 'synthetic-set', source: { id: 'synthetic', title: 'Synthetic paper' }, testNumber: 1, title: 'Synthetic paper', kind: 'mock_paper', purpose: 'training', template: { id: 'ket-schools-2020-v1', version: 1 } },
    content: { schemaVersion: 1, id: 'synthetic-revision', contentSetId: 'synthetic-set', revision: 1, status: 'draft', groups,
      materials: groups.map(item => ({ id: `${item.id}:material`, familyId: `${item.id}:family`, role: 'exam', title: 'Synthetic material', blocks: [{ id: 'text', kind: 'text', text: 'Synthetic text.' }], provenance })),
      guidance: [], vocabularyLinks: [], mediaSlots: [], mediaBindingRevisionId: null, readiness: { exam: { status: 'pending' }, explanations: { status: 'pending' } } },
    solutions: { schemaVersion: 1, contentRevisionId: 'synthetic-revision', solutions: [choiceKey(first), choiceKey(second), choiceKey(listening)], teacherNotes: [], mediaSlots: [] },
  }
  return { draft, first, second, example, listening, writing, speaking }
}
function started(draft: ExamDraftInput, sectionId = 'reading_writing', listeningMs: number | null = null): ExamAttemptState {
  return applyExamOperation(draft, newExamAttempt(draft, 'mock', undefined, at(0)), 'start', { sectionId }, at(0), listeningMs).state
}
function answer(optionId: string): ExamAnswer { return { type: 'single_choice', optionId } }

function gaps(answerOrder: 'fixed' | 'any' = 'fixed'): GapFillQuestion {
  return { ...base('gap', 'reading_writing', 5), answerType: 'gap_fill', gaps: ['one', 'two', ...(answerOrder === 'any' ? ['three'] : [])].map(id => ({ id, label: id, maxWords: 1 })), answerOrder, scoring: { kind: 'objective', maxPoints: 1 } }
}
function gapKey(question: GapFillQuestion, combinations: string[][]): Solution {
  return { ...solutionBase(question), answerType: 'gap_fill', normalization: { trim: true, ignoreCase: true },
    acceptedAnswerSets: combinations.map(values => question.gaps.map((gap, index) => ({ gapId: gap.id, value: values[index] }))) }
}

describe('synthetic exam question grading', () => {
  it('grades a single choice and distinguishes a blank from a wrong choice', () => {
    const question = choice(), key = choiceKey(question)
    expect(scoreExamQuestion(question, answer('A'), key)).toMatchObject({ outcome: 'correct', points: 1, maxPoints: 1 })
    expect(scoreExamQuestion(question, answer('B'), key)).toMatchObject({ outcome: 'incorrect', points: 0 })
    expect(scoreExamQuestion(question, answer(''), key)).toMatchObject({ outcome: 'unanswered', points: 0 })
    expect(scoreExamQuestion(question, undefined, key).outcome).toBe('unanswered')
  })

  it('accepts only complete authored gap combinations, never their Cartesian product', () => {
    const question = gaps(), key = gapKey(question, [['is', 'he'], ['are', 'they']])
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: ' IS ', two: 'He' } }, key).outcome).toBe('correct')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'are', two: 'they' } }, key).outcome).toBe('correct')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'is', two: 'they' } }, key).outcome).toBe('incorrect')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'are', two: 'he' } }, key).outcome).toBe('incorrect')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'is' } }, key).outcome).toBe('incorrect')
  })

  it('compares an any-order answer as a multiset retaining duplicate counts', () => {
    const question = gaps('any'), key = gapKey(question, [['red', 'red', 'blue']])
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'BLUE', two: ' red ', three: 'red' } }, key).outcome).toBe('correct')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'blue', two: 'red', three: 'blue' } }, key).outcome).toBe('incorrect')
    expect(scoreExamQuestion(question, { type: 'gap_fill', values: { one: 'red', two: 'blue' } }, key).outcome).toBe('incorrect')
  })

  it('grades complete matching alternatives without mixing pairs between alternatives', () => {
    const question: MatchingQuestion = { ...base('match', 'reading_writing', 2), answerType: 'matching', items: [{ id: 'one', prompt: [] }, { id: 'two', prompt: [] }], optionPoolId: 'pool', scoring: { kind: 'objective', maxPoints: 1 } }
    const key: Solution = { ...solutionBase(question), answerType: 'matching', acceptedMatches: [
      [{ itemId: 'one', optionId: 'A' }, { itemId: 'two', optionId: 'B' }],
      [{ itemId: 'one', optionId: 'B' }, { itemId: 'two', optionId: 'C' }],
    ] }
    expect(scoreExamQuestion(question, { type: 'matching', matches: { one: 'B', two: 'C' } }, key).outcome).toBe('correct')
    expect(scoreExamQuestion(question, { type: 'matching', matches: { one: 'A', two: 'C' } }, key).outcome).toBe('incorrect')
    expect(scoreExamQuestion(question, { type: 'matching', matches: { one: 'A' } }, key).outcome).toBe('incorrect')
  })

  it('leaves manual writing and speaking pending and never scores an exam example', () => {
    const { writing, speaking, example } = fixture()
    expect(scoreExamQuestion(writing, { type: 'writing', text: 'A synthetic response.' }, undefined)).toMatchObject({ outcome: 'pending', points: null, maxPoints: null })
    expect(scoreExamQuestion(speaking, { type: 'speaking', recordingIds: [], abandoned: true }, undefined)).toMatchObject({ outcome: 'pending', points: null, maxPoints: null })
    expect(scoreExamQuestion(example, answer('A'), undefined)).toMatchObject({ outcome: 'unscored', points: null, maxPoints: null })
  })

  it('rejects undeclared answer fields, options and gap identifiers at the input boundary', () => {
    const question = choice(), scope = group('one', [question])
    expect(() => parseExamAnswer({ type: 'single_choice', optionId: 'A', points: 1 }, question, scope)).toThrow('exam_invalid_answer')
    expect(() => parseExamAnswer({ type: 'single_choice', optionId: 'C' }, question, scope)).toThrow('exam_invalid_answer')
    const gap = gaps()
    expect(() => parseExamAnswer({ type: 'gap_fill', values: { unknown: 'is' } }, gap, group('gap', [gap]))).toThrow('exam_invalid_answer')
  })
})

describe('synthetic attempt scope and submission', () => {
  it('refuses mock help but records practice help only once', () => {
    const { draft, first, listening } = fixture()
    const mock = started(draft)
    expect(() => applyExamOperation(draft, mock, 'help', { questionId: first.id }, at(1))).toThrow('exam_help_unavailable')
    const practice = newExamAttempt(draft, 'practice', 'reading', at(0))
    const helped = applyExamOperation(draft, practice, 'help', { questionId: first.id }, at(1)).state
    const again = applyExamOperation(draft, helped, 'help', { questionId: first.id }, at(2)).state
    expect(again.helpQuestionIds).toEqual([first.id])
    expect(practice.helpQuestionIds).toEqual([])
    expect(() => applyExamOperation(draft, again, 'help', { questionId: listening.id }, at(3))).toThrow('exam_help_unavailable')
  })

  it('saves the answer without grading or mutating the supplied state', () => {
    const { draft, first } = fixture()
    const original = started(draft)
    const saved = applyExamOperation(draft, original, 'save', { answers: { [first.id]: answer('B') } }, at(10)).state
    expect(saved.answers[first.id]).toEqual(answer('B'))
    expect(saved.results).toEqual({})
    expect(saved.sections.reading_writing.status).toBe('active')
    expect(original.answers).toEqual({})
    expect(original.results).toEqual({})
  })

  it('submits the latest answer in the current section, leaving other sections untouched', () => {
    const { draft, first, second, writing, example, listening, speaking } = fixture()
    const saved = applyExamOperation(draft, started(draft), 'save', { answers: { [first.id]: answer('B') } }, at(10)).state
    const submitted = applyExamOperation(draft, saved, 'submit', { answers: {
      [first.id]: answer('A'), [writing.id]: { type: 'writing', text: 'Final synthetic writing.' },
    } }, at(20)).state
    expect(submitted.answers[first.id]).toEqual(answer('A'))
    expect(submitted.results[first.id].outcome).toBe('correct')
    expect(submitted.results[second.id].outcome).toBe('unanswered')
    expect(submitted.results[writing.id].outcome).toBe('pending')
    expect(submitted.results[example.id]).toMatchObject({ outcome: 'unscored', points: null })
    expect(submitted.results[listening.id]).toBeUndefined()
    expect(submitted.results[speaking.id]).toBeUndefined()
    expect(submitted.sections.listening.status).toBe('not_started')
    expect(submitted.sections.reading_writing).toMatchObject({ status: 'submitted', submittedAt: at(20), timedOut: false })
    expect(submitted.currentSectionId).toBeNull()
    expect(saved.answers[first.id]).toEqual(answer('B'))
    expect(saved.results).toEqual({})
  })

  it('rejects answers, examples and navigation outside the current editable scope', () => {
    const { draft, first, listening, example } = fixture()
    const state = started(draft)
    expect(() => applyExamOperation(draft, state, 'save', { answers: { [listening.id]: answer('A') } }, at(1))).toThrow('exam_invalid_answer')
    expect(() => applyExamOperation(draft, state, 'submit', { answers: { [first.id]: answer('A'), [listening.id]: answer('A') } }, at(1))).toThrow('exam_invalid_answer')
    expect(() => applyExamOperation(draft, state, 'save', { groupId: 'listening' }, at(1))).toThrow('exam_invalid_answer')
    expect(() => applyExamOperation(draft, state, 'save', { answers: { [example.id]: answer('A') } }, at(1))).toThrow('exam_invalid_answer')
    expect(state.answers).toEqual({})
  })

  it('expires exactly at the deadline using saved answers, ignoring late command answers', () => {
    const { draft, first, listening } = fixture()
    const saved = applyExamOperation(draft, started(draft), 'save', { answers: { [first.id]: answer('B') } }, at(3599)).state
    expect(() => applyExamOperation(draft, saved, 'expire', {}, at(3599))).toThrow('exam_invalid_transition')
    expect(() => applyExamOperation(draft, saved, 'submit', { answers: { [first.id]: answer('A') } }, at(3600))).toThrow('exam_expired')
    const expired = applyExamOperation(draft, saved, 'expire', { answers: { [first.id]: answer('A'), [listening.id]: answer('A') } }, at(3600)).state
    expect(expired.answers[first.id]).toEqual(answer('B'))
    expect(expired.answers[listening.id]).toBeUndefined()
    expect(expired.results[first.id].outcome).toBe('incorrect')
    expect(expired.results[listening.id]).toBeUndefined()
    expect(expired.sections.reading_writing).toMatchObject({ status: 'submitted', timedOut: true, submittedAt: at(3600) })
    expect(saved.sections.reading_writing.status).toBe('active')
  })
})

describe('synthetic listening interruption clock', () => {
  it('extends each interrupted interval once and rejects a repeated resume', () => {
    const { draft } = fixture()
    const initial = started(draft, 'listening', 60_000)
    expect(initial.sections.listening.deadlineAt).toBe(at(60))
    const interrupted = applyExamOperation(draft, initial, 'interrupt', {}, at(10)).state
    expect(interrupted.sections.listening).toMatchObject({ status: 'interrupted', interruptedAt: at(10), deadlineAt: at(60), technicalInterruption: true })
    const resumed = applyExamOperation(draft, interrupted, 'resume', {}, at(40)).state
    expect(resumed.sections.listening).toMatchObject({ status: 'active', interruptedAt: null, deadlineAt: at(90), technicalInterruption: true })
    expect(() => applyExamOperation(draft, resumed, 'resume', {}, at(45))).toThrow('exam_invalid_transition')
    const secondInterruption = applyExamOperation(draft, resumed, 'interrupt', {}, at(45)).state
    const secondResume = applyExamOperation(draft, secondInterruption, 'resume', {}, at(50)).state
    expect(secondResume.sections.listening.deadlineAt).toBe(at(95))
    expect(interrupted.sections.listening.deadlineAt).toBe(at(60))
    expect(resumed.sections.listening.deadlineAt).toBe(at(90))
  })

  it('allows an interrupted listening section to resume after its former deadline', () => {
    const { draft } = fixture()
    const interrupted = applyExamOperation(draft, started(draft, 'listening', 60_000), 'interrupt', {}, at(20)).state
    const resumed = applyExamOperation(draft, interrupted, 'resume', {}, at(100)).state
    expect(resumed.sections.listening.deadlineAt).toBe(at(140))
    expect(resumed.sections.listening.timedOut).toBe(false)
    expect(() => applyExamOperation(draft, started(draft), 'interrupt', {}, at(1))).toThrow('exam_invalid_transition')
  })
})
