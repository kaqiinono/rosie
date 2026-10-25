import { describe, expect, it } from 'vitest'
import { layoutOccurrences, nextPreviewOccurrence, previewOccurrences, ruleOccursOn, timetableStats } from '../../../packages/tasks/src/timetable'
import { atTime } from '../../../packages/tasks/src/time'
import type { CourseOccurrence, TaskCourse, TaskData, TimetableRule } from '../../../packages/tasks/src/types'

const course: TaskCourse = { id: 'english', user_id: 'u', name: '英语', subject: 'english', created_at: atTime('2026-10-01', '08:00') }
const rule: TimetableRule = { id: 'r1', user_id: 'u', course_id: course.id, weekday: 5, start_time: '10:00', end_time: '10:45', valid_from: '2026-10-23', valid_until: null, recurrence: 'weekly', interval_weeks: 2, anchor_date: '2026-10-19' }
const data = (rules: TimetableRule[] = [rule]): Pick<TaskData, 'courses' | 'rules' | 'exceptions' | 'occurrences'> => ({ courses: [course], rules, exceptions: [], occurrences: [] })
const occurrence = (id: string, start: string, end: string, status: CourseOccurrence['status'] = 'scheduled'): CourseOccurrence => ({ id, user_id: 'u', course_id: course.id, rule_id: rule.id, original_date: '2026-10-23', starts_at: atTime('2026-10-23', start), ends_at: atTime('2026-10-23', end), status, confirmation: null })

describe('timetable recurrence and identity', () => {
  it('anchors alternating weeks and includes both validity boundaries', () => {
    expect(ruleOccursOn(rule, '2026-10-23')).toBe(true)
    expect(ruleOccursOn(rule, '2026-10-30')).toBe(false)
    expect(ruleOccursOn({ ...rule, valid_until: '2026-11-06' }, '2026-11-06')).toBe(true)
    expect(ruleOccursOn({ ...rule, valid_until: '2026-11-06' }, '2026-11-20')).toBe(false)
  })

  it('interprets teaching week numbers relative to the anchor across New Year', () => {
    const specific = { ...rule, weekday: 1, valid_from: '2026-12-28', anchor_date: '2026-12-28', recurrence: 'weeks' as const, teaching_weeks: [1, 3, 6] }
    expect(ruleOccursOn(specific, '2026-12-28')).toBe(true)
    expect(ruleOccursOn(specific, '2027-01-04')).toBe(false)
    expect(ruleOccursOn(specific, '2027-01-11')).toBe(true)
    expect(ruleOccursOn(specific, '2027-02-01')).toBe(true)
  })

  it('shows a moved occurrence in its actual date range and keeps its original identity', () => {
    const moved = data()
    moved.exceptions = [{ id: 'e', user_id: 'u', rule_id: rule.id, original_date: '2026-10-23', cancelled: false, starts_at: atTime('2026-11-02', '11:00'), ends_at: atTime('2026-11-02', '11:45') }]
    expect(previewOccurrences(moved, '2026-10-23', '2026-10-23')).toEqual([])
    const result = previewOccurrences(moved, '2026-11-02', '2026-11-02')
    expect(result).toHaveLength(1)
    expect(result[0].original_date).toBe('2026-10-23')
    expect(moved.occurrences).toEqual([])
  })

  it('finds a next class beyond the old five-week window', () => {
    const sparse = data([{ ...rule, interval_weeks: 8 }])
    const next = nextPreviewOccurrence(sparse, new Date(atTime('2026-10-24', '00:00')))
    expect(next?.starts_at).toBe(atTime('2026-12-18', '10:00'))
  })

  it('retains confirmed history after a course is archived', () => {
    const archived = data()
    archived.courses = [{ ...course, archived_at: atTime('2026-10-24', '00:00') }]
    archived.occurrences = [occurrence('confirmed', '10:00', '10:45', 'confirmed')]
    expect(previewOccurrences(archived, '2026-10-23', '2026-10-23')[0].id).toBe('confirmed')
    expect(previewOccurrences(archived, '2026-11-06', '2026-11-06')).toEqual([])
  })

  it('places overlapping courses beside each other and ignores cancelled busy lanes', () => {
    const items = [occurrence('one', '08:00', '08:45'), occurrence('two', '08:00', '09:00'), occurrence('cancelled', '08:00', '10:00', 'cancelled'), occurrence('three', '09:00', '10:00')]
    const layout = layoutOccurrences(items)
    expect(layout).toHaveLength(3)
    expect(layout.slice(0, 2).map(item => item.column)).toEqual([0, 1])
    expect(layout.slice(0, 2).every(item => item.columns === 2)).toBe(true)
    expect(layout[2].columns).toBe(1)
    expect(timetableStats(items)).toEqual({ courses: 1, occurrences: 3, minutes: 165, conflicts: 2 })
  })
})
