import { describe, expect, it, beforeEach } from 'vitest'
import {
  getTodayPlanSyncStatus,
  todayStr,
  writeLocalPending,
  type PracticePendingEnvelope,
} from '../../../packages/core/src/index'
import {
  chinesePracticeLegacyScopeKey,
  chinesePracticeScopeKey,
} from '../../../packages/chinese/src/utils/chinese-practice-session-snapshot'

const TODAY = todayStr()

function envelope<T>(stash: T): PracticePendingEnvelope<T> {
  return { version: 1, savedAt: new Date().toISOString(), date: TODAY, stash }
}

describe('chinesePracticeScopeKey', () => {
  it('isolates free practice from roadmap plan practice with the same lessons/types', () => {
    const base = {
      bookSlug: 'g2a',
      units: '',
      lessons: 'u1-l1,u1-l2',
      types: 'recognize,phrase,passage',
      cardPreview: '1',
    }
    const free = chinesePracticeScopeKey({ ...base, planId: null })
    const plan = chinesePracticeScopeKey({ ...base, planId: 'plan-abc' })
    const otherPlan = chinesePracticeScopeKey({ ...base, planId: 'plan-xyz' })

    expect(free).toContain('|p=free')
    expect(plan).toContain('|p=plan-abc')
    expect(free).not.toBe(plan)
    expect(plan).not.toBe(otherPlan)
  })

  it('legacy scope key omits the plan segment (pre-isolation format)', () => {
    const legacy = chinesePracticeLegacyScopeKey({
      bookSlug: 'g2a',
      units: '',
      lessons: 'u1-l1',
      types: 'recognize',
      cardPreview: '1',
    })
    expect(legacy).toBe('g2a|u=|l=u1-l1|t=recognize|c=1')
    expect(legacy).not.toContain('|p=')
  })
})

describe('getTodayPlanSyncStatus — chinese free vs plan', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not light the today chinese card for free-practice pending', () => {
    const freeKey = chinesePracticeScopeKey({
      bookSlug: 'g2a',
      units: '',
      lessons: 'u1-l1',
      types: 'recognize',
      cardPreview: '1',
      planId: null,
    })
    writeLocalPending('chinese', freeKey, envelope({ n: 1 }))
    expect(getTodayPlanSyncStatus().chinese).toBe('none')
  })

  it('still lights the today chinese card for roadmap plan pending', () => {
    const planKey = chinesePracticeScopeKey({
      bookSlug: 'g2a',
      units: '',
      lessons: 'u1-l1',
      types: 'recognize',
      cardPreview: '1',
      planId: 'plan-abc',
    })
    writeLocalPending('chinese', planKey, envelope({ n: 1 }))
    expect(getTodayPlanSyncStatus().chinese).toBe('unsynced')
  })
})
