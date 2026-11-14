// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { QuestionId } from '../../../packages/exams/src/types/content'
import type { SingleChoiceQuestion } from '../../../packages/exams/src/types/questions'
import type { ExamReportEvidence } from '../../../packages/exams/src/types/reports'
import type { ReportAttemptRow, ReportRevisionRow } from '../src/lib/exams/insights'
import { buildExamInsights, collectExamEvidence, reportWindow } from '../src/lib/exams/insights'

vi.mock('server-only', () => ({}))

const now = Date.parse('2026-11-13T12:00:00Z')
const questionId: QuestionId = 'synthetic:test-1:exam:reading_writing:part-1:1'
const provenance = { origin: 'supplement' as const, sources: [], authorship: 'human' as const, review: { status: 'pending' as const } }

function revision(): ReportRevisionRow {
  const question: SingleChoiceQuestion = {
    id: questionId, answerType: 'single_choice', location: { sourceId: 'synthetic', testNumber: 1, role: 'exam', sectionId: 'reading_writing', partNumber: 1, questionNumber: '1' },
    prompt: [{ id: 'prompt', kind: 'text', text: 'SYNTHETIC_PRIVATE_QUESTION' }], options: [{ id: 'a', label: 'Synthetic option' }],
    scoring: { kind: 'objective', maxPoints: 1 }, provenance,
    classification: { domain: 'reading', questionTypeId: 'notice', primarySkillId: 'detail', knowledgePointIds: ['meaning'], topicIds: [], review: { status: 'pending' } },
  }
  return { id: 'revision', set_snapshot: { id: 'set', source: { id: 'synthetic', title: 'Synthetic test data' }, testNumber: 1,
    title: 'Synthetic reserved paper', kind: 'mock_paper', template: { id: 'ket-schools-2020-v1', version: 1 }, purpose: 'reserved' },
  content: { schemaVersion: 1, id: 'revision', contentSetId: 'set', revision: 1, status: 'published',
    materials: [{ id: 'material', familyId: 'family', role: 'exam', title: 'Synthetic', blocks: [{ id: 'text', kind: 'text', text: 'SYNTHETIC_RESERVED_MATERIAL' }], provenance }],
    groups: [{ id: 'group', role: 'exam', sectionId: 'reading_writing', partNumber: 1, instructions: [], materialIds: ['material'], optionPools: [], questions: [question], provenance }],
    guidance: [], vocabularyLinks: [], mediaSlots: [], mediaBindingRevisionId: null, readiness: { exam: { status: 'pending' }, explanations: { status: 'pending' } } } }
}

function attempt(id: string, submittedAt = '2026-11-12T08:00:00Z'): ReportAttemptRow {
  return { id, content_revision_id: 'revision', created_at: submittedAt, updated_at: submittedAt,
    state: { schemaVersion: 1, mode: 'mock', groupIds: ['group'], currentSectionId: null, currentGroupId: null,
      sections: { reading_writing: { status: 'submitted', startedAt: submittedAt, deadlineAt: null, submittedAt,
        interruptedAt: null, technicalInterruption: false, timedOut: false } },
      answers: { [questionId]: { type: 'single_choice', optionId: 'a' } }, results: { [questionId]: { questionId, outcome: 'correct', points: 1, maxPoints: 1 } },
      helpQuestionIds: [], priorExposureFamilies: [], groupActiveMs: {}, lastActivityAt: null, playbackPositionMs: 0, scriptGrant: null } }
}

function evidence(index: number, correct = index < 5): ExamReportEvidence {
  return { attemptId: index < 4 ? 'session-a' : 'session-b', questionId: `q${index}`, groupId: `g${index % 3}`, contentRevisionId: 'revision',
    submittedAt: '2026-11-12T08:00:00Z', sectionId: 'reading_writing', partNumber: 1, primarySkillId: 'detail', knowledgePointIds: ['meaning'],
    questionTypeId: 'notice', familyIds: [`family-${index % 3}`], correct, outcome: correct ? 'correct' : 'incorrect', included: true, exclusions: [], timedOut: false }
}

describe('exam report evidence, using synthetic data only', () => {
  it('uses Shanghai calendar boundaries with a fixed independent 28-day window', () => {
    const beforeMidnight = reportWindow(14, Date.parse('2026-11-13T15:59:59.999Z'))
    const midnight = reportWindow(14, Date.parse('2026-11-13T16:00:00.000Z'))
    expect(beforeMidnight.from).toBe('2026-10-30T16:00:00.000Z')
    expect(beforeMidnight.throughDate).toBe('2026-11-13')
    expect(midnight.from).toBe('2026-10-31T16:00:00.000Z')
    expect(midnight.throughDate).toBe('2026-11-14')
    expect(reportWindow(28, now).fromDate).toBe('2026-10-17')
  })

  it('only strengthens a label after all three sample gates, strictly below 70%', () => {
    const window = reportWindow(28, now)
    expect(buildExamInsights(Array.from({ length: 7 }, (_, i) => evidence(i)), window)[0].status).toBe('observe')
    expect(buildExamInsights(Array.from({ length: 8 }, (_, i) => evidence(i)), window)[0]).toMatchObject({ status: 'strengthen', numerator: 5, denominator: 8, familyCount: 3, sessionCount: 2 })
    expect(buildExamInsights(Array.from({ length: 10 }, (_, i) => evidence(i, i < 7)), window)[0].status).toBe('sufficient')
    expect(buildExamInsights(Array.from({ length: 8 }, (_, i) => ({ ...evidence(i), familyIds: ['one-family'] })), window)[0].status).toBe('observe')
    expect(buildExamInsights(Array.from({ length: 8 }, (_, i) => ({ ...evidence(i), attemptId: 'one-session' })), window)[0].status).toBe('observe')
  })

  it('never counts the same question again when its first attempt is outside the window', () => {
    const old = attempt('old', '2026-09-01T08:00:00Z')
    const current = attempt('current')
    const records = collectExamEvidence([current, old], new Map([['revision', revision()]]), [old, current].map(item => ({ attempt_id: item.id, family_id: 'family', seen_before: false, first_exposed_at: item.created_at })), reportWindow(28, now))
    expect(records.find(row => row.attemptId === 'old')?.exclusions).toContain('outside_window')
    expect(records.find(row => row.attemptId === 'current')?.exclusions).toContain('repeated_question')
    expect(records.filter(row => row.included)).toHaveLength(0)
  })

  it('distinguishes same-session exposure from earlier exposure, help and interruption', () => {
    const row = attempt('one')
    const revisions = new Map([['revision', revision()]])
    const exposure = { attempt_id: row.id, family_id: 'family', seen_before: false, first_exposed_at: row.created_at }
    expect(collectExamEvidence([row], revisions, [exposure], reportWindow(28, now))[0].included).toBe(true)
    expect(collectExamEvidence([row], revisions, [{ ...exposure, seen_before: true }], reportWindow(28, now))[0].exclusions).toContain('seen_material')
    expect(collectExamEvidence([row], revisions, [], reportWindow(28, now))[0].exclusions).toContain('missing_exposure')
    row.state.helpQuestionIds.push(questionId)
    row.state.sections.reading_writing.technicalInterruption = true
    expect(collectExamEvidence([row], revisions, [exposure], reportWindow(28, now))[0].exclusions).toEqual(expect.arrayContaining(['help', 'technical_interruption']))
  })

  it('returns source identifiers without reserved question text, material or saved answer', () => {
    const row = attempt('one')
    const records = collectExamEvidence([row], new Map([['revision', revision()]]), [], reportWindow(28, now))
    expect(JSON.stringify(records)).not.toContain('SYNTHETIC_PRIVATE_QUESTION')
    expect(JSON.stringify(records)).not.toContain('SYNTHETIC_RESERVED_MATERIAL')
    expect(JSON.stringify(records)).not.toContain('optionId')
    expect(records[0].questionId).toBe(questionId)
  })

  it('keeps pending manual work outside objective numerators and denominators', () => {
    const row = attempt('manual')
    const source = revision()
    const original = source.content.groups[0].questions[0]
    source.content = { ...source.content, groups: [{ ...source.content.groups[0], questions: [{
      id: original.id, location: original.location, prompt: original.prompt, classification: original.classification, provenance,
      answerType: 'writing', minimumWords: 25, scoring: { kind: 'manual', rubricId: 'synthetic-writing-rubric' },
    }] }] }
    row.state.answers[questionId] = { type: 'writing', text: 'Synthetic saved response.' }
    row.state.results[questionId] = { questionId, outcome: 'pending', points: null, maxPoints: null }
    const records = collectExamEvidence([row], new Map([['revision', source]]), [], reportWindow(28, now))
    expect(records[0]).toMatchObject({ outcome: 'pending', included: false })
    expect(records[0].exclusions).toContain('not_objective')
    expect(buildExamInsights(records, reportWindow(28, now))).toEqual([])
  })
})
