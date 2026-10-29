import { describe, expect, it } from 'vitest'
import { deriveCourseEventKey, normalizeCourseInput } from '../../../../packages/tasks/src/courseProgress'

const course = { name: '自主阅读', subject: 'english' as const, course_type: 'flexible' as const }
const rule = { weekday: 4, valid_from: '2026-10-29', valid_until: null }

describe('course contracts', () => {
  it('keeps flexible recurrence without inventing clock times', () => {
    const result = normalizeCourseInput(course, [{ ...rule, recurrence: 'weeks', teaching_weeks: [1, 3], interval_weeks: 2 }])
    expect(result.rules[0]).toMatchObject({ kind: 'flexible', start_time: null, end_time: null, weekday: 4, recurrence: 'weeks', teaching_weeks: [1, 3], interval_weeks: 2 })
    expect(result.course).toMatchObject({ course_type: 'flexible', auto_assign: false, auto_advance: false })
  })
  it('rejects flexible rules with clock times', () => {
    expect(() => normalizeCourseInput(course, [{ ...rule, start_time: '09:00', end_time: '10:00' }])).toThrow('flexible_rule_has_time')
  })
  it('requires a weekday and at least one rule for flexible courses', () => {
    expect(() => normalizeCourseInput(course, [])).toThrow('rules_required')
    expect(() => normalizeCourseInput(course, [{ ...rule, weekday: 7 }])).toThrow('invalid_weekday')
  })
  it('requires both clock times for timetabled courses', () => {
    expect(() => normalizeCourseInput({ ...course, course_type: 'timetabled' }, [rule])).toThrow('timetabled_rule_requires_time')
    expect(() => normalizeCourseInput({ ...course, course_type: 'timetabled' }, [{ ...rule, start_time: '09:00' }])).toThrow('timetabled_rule_requires_time')
  })
  it('preserves old timed input and defaults it to timetabled with automation off', () => {
    expect(normalizeCourseInput({ name: '纳约', subject: 'math' }, [{ ...rule, start_time: '09:00', end_time: '10:00' }])).toMatchObject({ course: { course_type: 'timetabled', auto_assign: false, auto_advance: false }, rules: [{ kind: 'timetabled', start_time: '09:00', end_time: '10:00' }] })
  })
  it('rejects invalid time, date and recurrence ranges rather than accepting malformed rules', () => {
    const timed = { ...rule, start_time: '10:00', end_time: '09:00' }
    expect(() => normalizeCourseInput({ ...course, course_type: 'timetabled' }, [timed])).toThrow('invalid_time_range')
    expect(() => normalizeCourseInput(course, [{ ...rule, valid_from: '2026-02-30' }])).toThrow('invalid_date')
    expect(() => normalizeCourseInput(course, [{ ...rule, recurrence: 'weeks', teaching_weeks: [] }])).toThrow('teaching_weeks_required')
    expect(() => normalizeCourseInput(course, [{ ...rule, interval_weeks: 0 }])).toThrow('invalid_interval_weeks')
  })
  it('deduplicates default flexible events by course and Shanghai calendar date', () => {
    const first = deriveCourseEventKey({ kind: 'flexible', course_id: 'course-1', on_date: '2026-10-29' })
    const duplicate = deriveCourseEventKey({ kind: 'flexible', course_id: 'course-1', on_date: '2026-10-29' })
    expect(first).toBe('flexible:course-1:2026-10-29')
    expect(duplicate).toBe(first)
    expect(deriveCourseEventKey({ kind: 'flexible', course_id: 'course-1', on_date: '2026-10-29', extra_event_id: 'make-up' })).toBe('flexible:course-1:2026-10-29:extra:make-up')
  })
  it('rejects empty supplied dates and mismatched course/rule kinds', () => {
    expect(() => normalizeCourseInput(course, [{ ...rule, valid_until: '' }])).toThrow('invalid_date')
    expect(() => normalizeCourseInput(course, [{ ...rule, anchor_date: '' }])).toThrow('invalid_date')
    expect(() => normalizeCourseInput(course, [{ ...rule, kind: 'timetabled' }])).toThrow('course_rule_type_mismatch')
  })
  it('does not allow separators in external identities to collide with extra events', () => {
    expect(deriveCourseEventKey({ kind: 'flexible', course_id: 'a:b', on_date: '2026-10-29' })).toBe('flexible:a%3Ab:2026-10-29')
    expect(deriveCourseEventKey({ kind: 'flexible', course_id: 'a', on_date: '2026-10-30' })).not.toBe('flexible:a:2026-10-29')
  })
  it('distinguishes timetabled slots and rejects invalid event identity', () => {
    expect(deriveCourseEventKey({ kind: 'timetabled', rule_id: 'morning', on_date: '2026-10-29' })).toBe('timetabled:morning:2026-10-29')
    expect(deriveCourseEventKey({ kind: 'timetabled', rule_id: 'afternoon', on_date: '2026-10-29' })).not.toBe('timetabled:morning:2026-10-29')
    expect(() => deriveCourseEventKey({ kind: 'flexible', course_id: '', on_date: '2026-10-29' })).toThrow('invalid_event_identity')
    expect(() => deriveCourseEventKey({ kind: 'flexible', course_id: 'x', on_date: '2026-02-30' })).toThrow('invalid_date')
  })
})
