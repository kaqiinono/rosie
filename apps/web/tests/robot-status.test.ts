import { describe, it, expect } from 'vitest'
import { deriveStatus } from '@rosie/robot'
import type { RobotTask } from '@rosie/robot'

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
})
