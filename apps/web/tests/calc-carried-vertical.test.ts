import { describe, it, expect } from 'vitest'
import { buildSession } from '@rosie/calc'
import type { CalcMistake, CalcProblemState, CalcSettings } from '@rosie/core'

function baseSettings(over: Partial<CalcSettings> = {}): CalcSettings {
  return {
    countMode: 'manual',
    selectedBlocks: [{ id: 'add:10', count: 1, seconds: 0 }],
    mixedOps: [],
    soundEnabled: false,
    includeInverse: false,
    verticalForBigNumbers: true,
    timedAnswerEnabled: false,
    immersiveMode: false,
    lastCount: 1,
    sessionCounter: 1,
    timingMode: 'relaxed',
    bonusSec: 0,
    autoSubmitOnMatch: true,
    adaptiveExpansionEnabled: false,
    ...over,
  }
}

describe('buildSession carried 竖式 restore', () => {
  it('caps carried mistakes inside the shared remediation budget', () => {
    const carried: CalcMistake[] = Array.from({ length: 5 }, (_, index) => ({
      signature: `add(${index + 1},1)`,
      display: `${index + 1} + 1`,
      answer: { kind: 'int' as const, value: index + 2 },
      level: 1,
      category: 'addsub' as const,
      lastWrongAt: '',
      consecutiveCorrect: 0,
      resolved: false,
      sessionNo: 1,
    }))
    const session = buildSession(
      baseSettings({
        selectedBlocks: [{ id: 'add:10', count: 20, seconds: 0 }],
        lastCount: 20,
      }),
      { problemStates: new Map() },
      carried,
    )
    expect(
      session.filter((question) => question.selectionReason === 'carried-mistake'),
    ).toHaveLength(3)
  })

  it('restores vertical from problem_state.blockId', () => {
    const sig = 'mul(346,7)'
    const states = new Map<string, CalcProblemState>([
      [
        sig,
        {
          signature: sig,
          level: 1,
          proficiency: 1,
          attemptCount: 2,
          appearanceCount: 2,
          recentResults: [],
          status: 'active',
          consecutiveWrong: 1,
          consecutiveCorrect: 0,
          updatedAt: new Date().toISOString(),
          blockId: 'mul:3d1d-c',
        },
      ],
    ])
    const carried: CalcMistake[] = [
      {
        signature: sig,
        display: '346 × 7',
        answer: { kind: 'int', value: 2422 },
        level: 1,
        category: 'muldiv',
        lastWrongAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        sessionNo: 1,
      },
    ]
    const session = buildSession(baseSettings(), { problemStates: states }, carried)
    const q = session.find((x) => x.signature === sig)
    expect(q).toBeTruthy()
    expect(q!.sourceBlockId).toBe('mul:3d1d-c')
    expect(q!.answerMode).toBe('vertical')
  })

  it('infers vertical for carry 3d×1d when blockId is missing; skips no-carry', () => {
    const carrySig = 'mul(144,3)' // consecutive carry → vertical
    const noCarrySig = 'mul(234,2)' // no carry → pad
    const carried: CalcMistake[] = [
      {
        signature: carrySig,
        display: '144 × 3',
        answer: { kind: 'int', value: 432 },
        level: 1,
        category: 'muldiv',
        lastWrongAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        sessionNo: 1,
      },
      {
        signature: noCarrySig,
        display: '234 × 2',
        answer: { kind: 'int', value: 468 },
        level: 1,
        category: 'muldiv',
        lastWrongAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        sessionNo: 1,
      },
    ]
    const session = buildSession(
      baseSettings({ lastCount: 2, selectedBlocks: [{ id: 'add:10', count: 2, seconds: 0 }] }),
      { problemStates: new Map() },
      carried,
    )
    const carryQ = session.find((x) => x.signature === carrySig)
    const noCarryQ = session.find((x) => x.signature === noCarrySig)
    expect(carryQ!.sourceBlockId).toBe('mul:3d1d-c')
    expect(carryQ!.answerMode).toBe('vertical')
    expect(noCarryQ!.answerMode).not.toBe('vertical')
  })

  it('1000-within add/sub: vertical only when carry/borrow', () => {
    const states = new Map<string, CalcProblemState>()
    const mkState = (sig: string, blockId: string): void => {
      states.set(sig, {
        signature: sig,
        level: 1,
        proficiency: 1,
        attemptCount: 1,
        appearanceCount: 1,
        recentResults: [],
        status: 'active',
        consecutiveWrong: 0,
        consecutiveCorrect: 0,
        updatedAt: new Date().toISOString(),
        blockId,
      })
    }
    mkState('add(123,456)', 'add:1000') // no carry
    mkState('add(178,256)', 'add:1000') // ones carry
    mkState('sub(586,123)', 'sub:1000') // no borrow
    mkState('sub(501,123)', 'sub:1000') // borrow
    const carried: CalcMistake[] = [
      { signature: 'add(123,456)', display: '123 + 456', answer: { kind: 'int', value: 579 }, level: 1, category: 'addsub', lastWrongAt: '', consecutiveCorrect: 0, resolved: false, sessionNo: 1 },
      { signature: 'add(178,256)', display: '178 + 256', answer: { kind: 'int', value: 434 }, level: 1, category: 'addsub', lastWrongAt: '', consecutiveCorrect: 0, resolved: false, sessionNo: 1 },
      { signature: 'sub(586,123)', display: '586 − 123', answer: { kind: 'int', value: 463 }, level: 1, category: 'addsub', lastWrongAt: '', consecutiveCorrect: 0, resolved: false, sessionNo: 1 },
      { signature: 'sub(501,123)', display: '501 − 123', answer: { kind: 'int', value: 378 }, level: 1, category: 'addsub', lastWrongAt: '', consecutiveCorrect: 0, resolved: false, sessionNo: 1 },
    ]
    const session = buildSession(
      baseSettings({
        // 27 planned questions gives a remediation ceiling of 4, so all four
        // fixtures remain available for this presentation-mode assertion.
        selectedBlocks: [{ id: 'add:10', count: 27, seconds: 0 }],
        lastCount: 27,
      }),
      { problemStates: states },
      carried,
    )
    expect(session.find((q) => q.signature === 'add(123,456)')!.answerMode).not.toBe('vertical')
    expect(session.find((q) => q.signature === 'add(178,256)')!.answerMode).toBe('vertical')
    expect(session.find((q) => q.signature === 'sub(586,123)')!.answerMode).not.toBe('vertical')
    expect(session.find((q) => q.signature === 'sub(501,123)')!.answerMode).toBe('vertical')
  })

  it('keeps strategy carry on number pad even with vertical switch on', () => {
    const sig = 'add(72,28)'
    const states = new Map<string, CalcProblemState>([
      [
        sig,
        {
          signature: sig,
          level: 1,
          proficiency: 1,
          attemptCount: 2,
          appearanceCount: 2,
          recentResults: [],
          status: 'active',
          consecutiveWrong: 1,
          consecutiveCorrect: 0,
          updatedAt: new Date().toISOString(),
          blockId: 'add:100-comp',
        },
      ],
    ])
    const carried: CalcMistake[] = [
      {
        signature: sig,
        display: '72 + 28',
        answer: { kind: 'int', value: 100 },
        level: 1,
        category: 'addsub',
        lastWrongAt: new Date().toISOString(),
        consecutiveCorrect: 0,
        resolved: false,
        sessionNo: 1,
      },
    ]
    const session = buildSession(baseSettings(), { problemStates: states }, carried)
    const q = session.find((x) => x.signature === sig)
    expect(q!.sourceBlockId).toBe('add:100-comp')
    expect(q!.answerMode).not.toBe('vertical')
  })
})
