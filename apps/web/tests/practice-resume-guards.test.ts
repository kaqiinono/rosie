import { describe, it, expect, beforeEach } from 'vitest'
import { todayStr } from '../../../packages/core/src/index'
import {
  loadLocalSessionSnapshot,
  pickBestPendingSnapshot,
  weeklySessionStorageKey,
  writeLocalSessionSnapshot,
} from '../../../packages/english/src/utils/weeklyPlanProgress'
import type { CalcQuestion, WeeklyPlanSessionStash } from '../../../packages/core/src/index'
import {
  readCalcSessionSnapshot,
  writeCalcSessionSnapshot,
  type CalcSessionSnapshot,
} from '../../../packages/calc/src/utils/calc-session-snapshot'

const TODAY = todayStr()
const PLAN_ID = 'plan-guard-1'

function stash(savedAt: string): WeeklyPlanSessionStash {
  return {
    version: 3,
    phase: 'quiz',
    selectedDate: TODAY,
    subTask: 'all',
    studyIdx: 0,
    words: [{ key: 'U1|L1|alpha', kind: 'consolidate' }],
    quizQs: [{ key: 'U1|L1|alpha', type: 'A', kind: 'consolidate' }],
    curQ: 0,
    quizResults: [],
    savedAt,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('english weekly stash — same-day guard', () => {
  it('resumes a stash saved today', () => {
    writeLocalSessionSnapshot(PLAN_ID, stash(new Date().toISOString()))
    expect(loadLocalSessionSnapshot(PLAN_ID)).not.toBeNull()
  })

  it('drops (and deletes) a stash saved on an earlier day', () => {
    // localStorage has no tab-lifetime TTL, so without this guard a Thursday
    // session would resume days later and complete Thursday's day.
    localStorage.setItem(
      weeklySessionStorageKey(PLAN_ID),
      JSON.stringify(stash('2020-01-01T10:00:00.000Z')),
    )

    expect(loadLocalSessionSnapshot(PLAN_ID)).toBeNull()
    expect(localStorage.getItem(weeklySessionStorageKey(PLAN_ID))).toBeNull()
  })

  it('ignores a stale cloud stash when picking the best snapshot', () => {
    expect(pickBestPendingSnapshot(PLAN_ID, stash('2020-01-01T10:00:00.000Z'))).toBeNull()
  })

  it('still prefers the newer of two same-day snapshots', () => {
    const older = new Date(Date.now() - 60_000).toISOString()
    const newer = new Date().toISOString()
    writeLocalSessionSnapshot(PLAN_ID, stash(older))

    expect(pickBestPendingSnapshot(PLAN_ID, stash(newer))?.savedAt).toBe(newer)
  })
})

function calcQuestion(display: string, signature: string, value: number): CalcQuestion {
  return {
    display,
    signature,
    arity: 2,
    level: 1,
    answer: { kind: 'int', value },
    isChallenge: false,
    category: 'addsub',
    coinBase: 1,
  }
}

function calcSnap(overrides: Partial<CalcSessionSnapshot> = {}): CalcSessionSnapshot {
  return {
    version: 1,
    date: TODAY,
    mode: 'daily',
    drillKey: null,
    questions: [calcQuestion('1+2', 'add(1,2)', 3), calcQuestion('2+3', 'add(2,3)', 5)],
    idx: 0,
    wrongQueue: [],
    plannedCount: 2,
    maxRetry: 0,
    coinsTotal: 0,
    streak: 0,
    maxStreak: 0,
    attemptsLog: [],
    questionTimesMs: [],
    questionLog: [],
    startedAtIso: new Date().toISOString(),
    startedTsMs: Date.now(),
    timingMode: 'relaxed',
    bonusSec: 0,
    drillTargetSignatures: [],
    ...overrides,
  }
}

describe('calc snapshot — requires real progress', () => {
  it('adds one stable idempotency key to resumable pending state', () => {
    writeCalcSessionSnapshot(calcSnap({ idx: 1 }))
    const first = readCalcSessionSnapshot('daily', null)?.idempotencyKey
    const second = readCalcSessionSnapshot('daily', null)?.idempotencyKey
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(second).toBe(first)
  })

  it('does not treat a zero-progress peek as resumable', () => {
    // Otherwise merely opening 口算 and backing out skips the prep screen and
    // replays that frozen question list for the rest of the day.
    writeCalcSessionSnapshot(calcSnap())
    expect(readCalcSessionSnapshot('daily', null)).toBeNull()
  })

  it('resumes once the child has advanced past the first question', () => {
    writeCalcSessionSnapshot(calcSnap({ idx: 1 }))
    expect(readCalcSessionSnapshot('daily', null)?.idx).toBe(1)
  })

  it('resumes when the first question was answered but not yet advanced', () => {
    writeCalcSessionSnapshot(
      calcSnap({
        attemptsLog: [
          {
            signature: 'add(1,2)',
            level: 1,
            isChallenge: false,
            firstTryCorrect: false,
            finallyCorrect: false,
            wasMistake: false,
            timeMs: 900,
            withinLimit: true,
            display: '1+2',
          },
        ],
      }),
    )
    expect(readCalcSessionSnapshot('daily', null)).not.toBeNull()
  })
})
