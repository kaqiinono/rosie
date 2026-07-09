import { describe, it, expect } from 'vitest'
import {
  maxRetryCeiling,
  clampBonusSec,
  resolveTargetSec,
  resolveClockSec,
  tryEnqueueRetry,
  sessionStarMultiplier,
  applySessionStarMultiplier,
} from '@rosie/calc'

describe('maxRetryCeiling', () => {
  it('uses 15% floored with floor of 3', () => {
    expect(maxRetryCeiling(20)).toBe(3)   // floor(3)=3
    expect(maxRetryCeiling(100)).toBe(15)
    expect(maxRetryCeiling(10)).toBe(3)   // floor(1.5)=1 → max 3
    expect(maxRetryCeiling(0)).toBe(3)
  })
})

describe('clampBonusSec', () => {
  it('clamps 0..15', () => {
    expect(clampBonusSec(-1)).toBe(0)
    expect(clampBonusSec(3.7)).toBe(3)
    expect(clampBonusSec(99)).toBe(15)
  })
})

describe('resolveTargetSec / resolveClockSec', () => {
  it('target prefers explicit > 0 else fluent for known block', () => {
    expect(resolveTargetSec({ explicitSeconds: 6, sourceId: 'mul:25' })).toBe(6)
    // mul:25 fluent[1] is 4 per TIME_TARGETS
    expect(resolveTargetSec({ explicitSeconds: 0, sourceId: 'mul:25' })).toBe(4)
    expect(resolveTargetSec({ explicitSeconds: null, sourceId: 'mul:25' })).toBe(4)
  })

  it('clock: strict=target, bonus=target+bonus, relaxed optional', () => {
    expect(resolveClockSec({
      mode: 'strict', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: null,
    })).toBe(5)
    expect(resolveClockSec({
      mode: 'bonus', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: null,
    })).toBe(8)
    expect(resolveClockSec({
      mode: 'relaxed', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: false, explicitSeconds: 6,
    })).toBeNull()
    expect(resolveClockSec({
      mode: 'relaxed', targetSec: 5, bonusSec: 3,
      timedAnswerEnabled: true, explicitSeconds: 6,
    })).toBe(6)
  })
})

describe('tryEnqueueRetry', () => {
  it('caps at maxRetry', () => {
    let pool: string[] = []
    let r = tryEnqueueRetry(pool, 'a', 2)
    expect(r.enqueued).toBe(true)
    pool = r.pool
    r = tryEnqueueRetry(pool, 'b', 2)
    expect(r.enqueued).toBe(true)
    pool = r.pool
    r = tryEnqueueRetry(pool, 'c', 2)
    expect(r.enqueued).toBe(false)
    expect(r.pool).toEqual(['a', 'b'])
  })
})

describe('sessionStarMultiplier', () => {
  it('relaxed 1, strict 1.2, bonus decays 5pp per second to floor 1', () => {
    expect(sessionStarMultiplier('relaxed', 0)).toBe(1)
    expect(sessionStarMultiplier('strict', 99)).toBe(1.2)
    expect(sessionStarMultiplier('bonus', 0)).toBe(1.2)
    expect(sessionStarMultiplier('bonus', 2)).toBeCloseTo(1.1)
    expect(sessionStarMultiplier('bonus', 4)).toBe(1)
    expect(sessionStarMultiplier('bonus', 10)).toBe(1)
  })

  it('applySessionStarMultiplier rounds', () => {
    expect(applySessionStarMultiplier(10, 'strict', 0)).toBe(12)
    expect(applySessionStarMultiplier(10, 'bonus', 2)).toBe(11)
    expect(applySessionStarMultiplier(10, 'relaxed', 0)).toBe(10)
  })
})
