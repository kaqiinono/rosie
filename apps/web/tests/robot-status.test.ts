import { describe, it, expect } from 'vitest'
// Import the pure helper + type directly (not via the @rosie/robot barrel): the
// barrel re-exports useRobotTasks → @rosie/core's supabase, whose createClient
// runs at import and throws without Supabase env. deriveStatus is Supabase-free.
import { deriveStatus } from '../../../packages/robot/src/robot-status'
import type { RobotTask } from '../../../packages/robot/src/robot-types'

const task = (o: Partial<RobotTask> = {}): RobotTask => ({
  id: 'task_001',
  title: 't',
  content: '',
  startTime: '09:00',
  endTime: '10:00',
  rewardCoins: 10,
  quickLink: '',
  completedAt: null,
  sortOrder: 0,
  ...o,
})
const at = (h: number, m: number) => new Date(2026, 5, 25, h, m)

describe('deriveStatus', () => {
  it('COMPLETED when completedAt set, regardless of time', () => {
    expect(deriveStatus(task({ completedAt: '2026-06-25T00:00:00Z' }), at(9, 30))).toBe('COMPLETED')
  })
  it('NOT_STARTED before the window', () => {
    expect(deriveStatus(task(), at(8, 59))).toBe('NOT_STARTED')
  })
  it('IN_PROGRESS within the window (inclusive of both ends)', () => {
    expect(deriveStatus(task(), at(9, 0))).toBe('IN_PROGRESS')
    expect(deriveStatus(task(), at(9, 30))).toBe('IN_PROGRESS')
    expect(deriveStatus(task(), at(10, 0))).toBe('IN_PROGRESS')
  })
  it('EXPIRED after the window', () => {
    expect(deriveStatus(task(), at(10, 1))).toBe('EXPIRED')
  })
  it('NOT_STARTED when times are malformed', () => {
    expect(deriveStatus(task({ startTime: '', endTime: '' }), at(12, 0))).toBe('NOT_STARTED')
  })
  it('NOT_STARTED when times are out of range (e.g. 25:00)', () => {
    expect(deriveStatus(task({ startTime: '25:00', endTime: '26:00' }), at(12, 0))).toBe('NOT_STARTED')
  })
  it('inverted window (start > end) never yields IN_PROGRESS — NOT_STARTED by design', () => {
    // Documents the same-day assumption: 10:00–09:00 is not supported.
    // With start=600, end=540, at 09:30 (cur=570): cur<start (570<600) → NOT_STARTED.
    expect(deriveStatus(task({ startTime: '10:00', endTime: '09:00' }), at(9, 30))).toBe('NOT_STARTED')
  })
})
