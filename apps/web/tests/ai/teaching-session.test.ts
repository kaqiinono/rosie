import { describe, expect, it } from 'vitest'
import {
  buildTeachingStagePrompt,
  classifyTeachingTurn,
  isExplicitTeachingBehavior,
  resolveTeachingEvidenceTarget,
  shouldHideFullSolution,
  teachingSessionActionSchema,
  teachingSessionStartSchema,
  TeachingSessionError,
  transitionTeachingSession,
  teachingCompletionKind,
  type TeachingSessionState,
} from '@rosie/ai'

function session(overrides: Partial<TeachingSessionState> = {}): TeachingSessionState {
  return {
    id: 'session-1',
    subject: 'math',
    teachingStage: 'understand',
    hintLevel: 0,
    attemptCount: 0,
    state: {},
    status: 'active',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('teaching session state machine', () => {
  it('starts by checking understanding', () => {
    expect(classifyTeachingTurn('这道题怎么做？')).toEqual({
      teachingStage: 'understand',
      hintLevel: 0,
      attemptCount: 0,
      status: 'active',
    })
  })

  it('records an attempt without declaring mastery', () => {
    const result = classifyTeachingTurn('我觉得先算 20 加 5', session())
    expect(result.teachingStage).toBe('attempt')
    expect(result.attemptCount).toBe(1)
    expect(result.status).toBe('active')
  })

  it('raises hints gradually and caps them at level three', () => {
    const result = classifyTeachingTurn(
      '还是不会，给我提示',
      session({ teachingStage: 'hint', hintLevel: 3 }),
    )
    expect(result.hintLevel).toBe(3)
    expect(buildTeachingStagePrompt(session({ teachingStage: 'hint', hintLevel: 3 }))).toContain(
      '第3级',
    )
  })

  it('uses transfer instead of writing mastery when the child says they understand', () => {
    const result = classifyTeachingTurn('我懂了', session({ attemptCount: 2 }))
    expect(result.teachingStage).toBe('transfer')
    expect(result.status).toBe('active')
  })

  it('hides complete math solutions during scaffolded stages', () => {
    expect(shouldHideFullSolution(session({ teachingStage: 'check' }))).toBe(true)
    expect(shouldHideFullSolution(session({ teachingStage: 'summary' }))).toBe(false)
  })

  it('uses distinct subject teaching strategies', () => {
    expect(
      buildTeachingStagePrompt(session({ subject: 'english', teachingStage: 'hint' })),
    ).toContain('首音/音节')
    expect(buildTeachingStagePrompt(session({ subject: 'math', teachingStage: 'hint' }))).toContain(
      '找条件',
    )
    expect(
      buildTeachingStagePrompt(session({ subject: 'chinese', teachingStage: 'hint' })),
    ).toContain('偏旁/关键字词')
  })

  it('persists an explicit attempt as a check-stage transition', () => {
    const result = transitionTeachingSession(
      session(),
      { type: 'record_attempt', answer: '25', errorKind: 'carry' },
      '2026-08-11T01:00:00.000Z',
    )
    expect(result).toMatchObject({
      teachingStage: 'check',
      attemptCount: 1,
      latestAnswer: '25',
      errorKind: 'carry',
      updatedAt: '2026-08-11T01:00:00.000Z',
    })
  })

  it('caps explicit hints and completes only through an explicit action', () => {
    const hinted = transitionTeachingSession(session({ hintLevel: 3 }), { type: 'request_hint' })
    expect(hinted.hintLevel).toBe(3)

    const completed = transitionTeachingSession(hinted, { type: 'complete' }, 'done-at')
    expect(completed).toMatchObject({
      teachingStage: 'summary',
      status: 'completed',
      completedAt: 'done-at',
    })
    expect(teachingCompletionKind(completed)).toBe('self_reported')
    expect(
      teachingCompletionKind(
        session({
          status: 'completed',
          state: { completion: { kind: 'verified', completedAt: 'verified-at' } },
        }),
      ),
    ).toBe('verified')
    expect(() => transitionTeachingSession(completed, { type: 'request_hint' })).toThrow(
      new TeachingSessionError('teaching_session_not_active'),
    )
  })

  it('validates session creation and action payloads', () => {
    expect(teachingSessionStartSchema.safeParse({ subject: 'science' }).success).toBe(false)
    expect(
      teachingSessionActionSchema.safeParse({ type: 'record_attempt', answer: '' }).success,
    ).toBe(false)
    expect(teachingSessionActionSchema.safeParse({ type: 'mark_correct' }).success).toBe(true)
  })

  it('does not treat ordinary chat as learning evidence', () => {
    expect(isExplicitTeachingBehavior('你好，今天心情不错')).toBe(false)
    expect(isExplicitTeachingBehavior('我觉得答案应该是 25')).toBe(true)
    expect(isExplicitTeachingBehavior('还是不会，给我提示')).toBe(true)
  })

  it('maps only supported authoritative evidence targets', () => {
    expect(resolveTeachingEvidenceTarget('word_entries:word-id')).toEqual({
      kind: 'english_word',
      entryId: 'word-id',
    })
    expect(resolveTeachingEvidenceTarget('math:problem:35-L1')).toEqual({
      kind: 'math_problem',
      problemId: '35-L1',
    })
    expect(resolveTeachingEvidenceTarget('chinese_char_entries:g2a-学')).toEqual({
      kind: 'chinese_char',
      charKey: 'g2a-学',
    })
    expect(resolveTeachingEvidenceTarget('unknown:anything')).toBeNull()
  })
})
