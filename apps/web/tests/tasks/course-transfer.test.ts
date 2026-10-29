import { describe, expect, it } from 'vitest'
import { schedulePayload, parseTimetableJSON, exportICS } from '../../../../packages/tasks/src/transfer'
import type { CourseDomainData } from '../../../../packages/tasks/src/courseTypes'
const data = { courses: [{ id: 'c', user_id: 'u', name: '自由阅读', subject: 'english', course_type: 'flexible', auto_assign: true, auto_advance: true, cursor: { lesson_key: 'private', segment_key: null }, created_at: '' }], course_rules: [{ id: 'r', user_id: 'u', course_id: 'c', kind: 'flexible', weekday: 1, start_time: null, end_time: null, valid_from: '2099-01-01', valid_until: null }], rules: [], calendars: [], exams: [], exceptions: [], occurrences: [] } as unknown as CourseDomainData
describe('schedule-only version 2', () => {
 it('retains flexible weekdays but excludes automation and learning progress', () => {
  const payload = schedulePayload(data)
  expect(payload.version).toBe(2)
  expect(payload.rules[0]).toMatchObject({ kind: 'flexible', weekday: 1, start_time: null })
  expect(payload.courses[0]).not.toHaveProperty('auto_assign')
  expect(payload.courses[0]).not.toHaveProperty('cursor')
  expect(parseTimetableJSON(JSON.stringify(payload)).rules[0].weekday).toBe(1)
 })
 it('does not emit all-day ICS and reports skipped flexible courses', () => {
  expect(exportICS(data, '2099-01-01', '2099-02-01')).not.toContain('BEGIN:VEVENT')
  expect(exportICS(data, '2099-01-01', '2099-02-01')).toContain('X-ROSIE-OMITTED-FLEXIBLE:1')
 })
})

it('accepts legacy v1 and strips hostile learning fields from imported schedule JSON', () => {
 const payload = parseTimetableJSON(JSON.stringify({ version: 1, calendars: [], courses: [{ id: 'c', name: '英语', subject: 'english', auto_assign: true, cursor: { lesson_key: 'secret', segment_key: null } }], rules: [{ id: 'r', course_id: 'c', weekday: 5, start_time: '10:00', end_time: '11:00', valid_from: '2099-01-01', valid_until: null }], exams: [] }))
 expect(payload.courses[0]).toMatchObject({ course_type: 'timetabled' })
 expect(payload.courses[0]).not.toHaveProperty('auto_assign')
 expect(payload.courses[0]).not.toHaveProperty('cursor')
 expect(payload.rules[0]).toMatchObject({ kind: 'timetabled', start_time: '10:00' })
})

it('roundtrips pending schedule effective metadata while dropping learning settings', () => {
 const pending = { ...data, courses: [{ ...data.courses[0], effective_from: '2099-03-01', default_deadline: { kind: 'same_day' as const, days: 0, time: '20:30', at: null } }] }
 const restored = parseTimetableJSON(JSON.stringify(schedulePayload(pending)))
 expect(restored.courses[0]).toHaveProperty('effective_from', '2099-03-01')
 expect(restored.courses[0]).not.toHaveProperty('default_deadline')
 expect(restored.courses[0]).not.toHaveProperty('auto_assign')
})
