import { describe, expect, it } from 'vitest'
import { atTime, blockNeedsReschedule, freeIntervals } from '../../../packages/tasks/src/time'
import type { AvailabilityWindow, CourseOccurrence, TaskTimeBlock } from '../../../packages/tasks/src/types'

const date = '2026-10-22' // Thursday
const window = (start: string, end: string, override = false): AvailabilityWindow => ({ id: start, user_id: 'u', weekday: 4, on_date: override ? date : null, start_time: start, end_time: end })
const block = (id: string, start: string, end: string): TaskTimeBlock => ({ id, user_id: 'u', task_id: 't', starts_at: atTime(date, start), ends_at: atTime(date, end) })
const course = (start: string, end: string, cancelled = false): CourseOccurrence => ({ id: start, user_id: 'u', course_id: 'c', rule_id: 'r', original_date: date, starts_at: atTime(date, start), ends_at: atTime(date, end), status: cancelled ? 'cancelled' : 'scheduled', confirmation: null })
const interval = (start: string, end: string) => ({ start: +new Date(atTime(date, start)), end: +new Date(atTime(date, end)) })

describe('independent task time planning', () => {
  it('subtracts nested courses and multiple task blocks without negative intervals', () => {
    expect(freeIntervals(date, [window('16:00', '20:00')], [course('17:00', '18:00'), course('17:15', '17:30')], [block('b', '18:30', '19:00')], 0)).toEqual([interval('16:00', '17:00'), interval('18:00', '18:30'), interval('19:00', '20:00')])
  })
  it('uses date overrides instead of the weekly windows', () => {
    expect(freeIntervals(date, [window('16:00', '20:00'), window('19:00', '20:00', true)], [], [], 0)).toEqual([interval('19:00', '20:00')])
  })
  it('supports an explicitly unavailable single day', () => {
    expect(freeIntervals(date, [window('16:00', '20:00'), { ...window('16:00', '20:00', true), unavailable: true }], [], [], 0)).toEqual([])
  })
  it('merges overlapping windows and clips elapsed time', () => {
    expect(freeIntervals(date, [window('16:00', '18:00'), window('17:00', '20:00')], [], [], +new Date(atTime(date, '17:30')))).toEqual([interval('17:30', '20:00')])
  })
  it('does not reserve cancelled courses or manufacture availability', () => {
    expect(freeIntervals(date, [window('16:00', '17:00')], [course('16:00', '17:00', true)], [], 0)).toEqual([interval('16:00', '17:00')])
    expect(freeIntervals(date, [], [], [], 0)).toEqual([])
  })
  it('flags a timetable conflict while excluding the block itself', () => {
    const b = block('b', '17:00', '17:30')
    expect(blockNeedsReschedule(b, [window('16:00', '20:00')], [], [b])).toBe(false)
    expect(blockNeedsReschedule(b, [window('16:00', '20:00')], [course('17:15', '18:00')], [b])).toBe(true)
    expect(blockNeedsReschedule(b, [window('18:00', '20:00')], [], [b])).toBe(true)
  })
  it('allows adjacent blocks and removes a fully occupied window', () => {
    expect(freeIntervals(date, [window('16:00', '17:00')], [], [block('b', '16:00', '16:30')], 0)).toEqual([interval('16:30', '17:00')])
    expect(freeIntervals(date, [window('16:00', '17:00')], [course('15:00', '18:00')], [], 0)).toEqual([])
  })
})
