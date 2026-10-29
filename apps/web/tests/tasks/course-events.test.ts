import { describe, expect, it } from 'vitest'
import * as progress from '../../../../packages/tasks/src/courseProgress'
import type { CourseCatalogSnapshot } from '../../../../packages/tasks/src/courseTypes'
const lesson = (key: string, unit = '1') => ({ key, title: key, book: 'book', unit, kind: 'lesson' })
const snapshot: CourseCatalogSnapshot = { id: 's', user_id: 'u', created_at: '', version: 'v', subject: 'math', source: 'manual', progression_mode: 'lesson', ordered_lessons: [lesson('a'), lesson('b')], teaching_segments: [] }
describe('durable course cursor', () => {
 it('advances manual math by explicit lesson policy and distinguishes catalog end', () => {
  expect(progress.advanceCourseCursor(snapshot, { lesson_key: 'a', segment_key: null })).toEqual({ kind: 'next', cursor: { lesson_key: 'b', segment_key: null } })
  expect(progress.advanceCourseCursor(snapshot, { lesson_key: 'b', segment_key: null })).toEqual({ kind: 'finished' })
 })
 it('pauses on open teaching segments and unconfigured next lessons', () => {
  const segmented = { ...snapshot, progression_mode: 'segment' as const, teaching_segments: [{ key: 'a1', lesson_key: 'a', title: '10–20', problem_keys: ['a:lesson:real-id'] }] }
  expect(progress.advanceCourseCursor(segmented, { lesson_key: 'a', segment_key: 'a1' })).toEqual({ kind: 'missing_segment', lesson_key: 'a' })
  segmented.teaching_segments[0] = { ...segmented.teaching_segments[0], completes_lesson: true } as typeof segmented.teaching_segments[0]
  expect(progress.advanceCourseCursor(segmented, { lesson_key: 'a', segment_key: 'a1' })).toEqual({ kind: 'missing_segment', lesson_key: 'b' })
 })
 it('never treats an invalid cursor or empty segment list as completed', () => {
  expect(progress.advanceCourseCursor({ ...snapshot, progression_mode: 'segment' }, { lesson_key: 'a', segment_key: null })).toEqual({ kind: 'missing_segment', lesson_key: 'a' })
  expect(() => progress.advanceCourseCursor(snapshot, { lesson_key: 'unknown', segment_key: null })).toThrow('invalid_course_cursor')
 })
})

import fixtures from '../../../../supabase/tests/fixtures/course-runtime.json'
import { matchTaskPool } from '../../../../packages/tasks/src/taskPool'
import type { CourseEvent, CourseTaskBinding, TaskPoolItem, CourseDeadlinePolicy } from '../../../../packages/tasks/src/courseTypes'
import * as events from '../../../../packages/tasks/src/courseEvents'
for (const row of fixtures.matching) it(`shared matching: ${row.name}`, () => {
 const actual = matchTaskPool(row.event as CourseEvent, row.bindings as CourseTaskBinding[], row.items as TaskPoolItem[], row.context)
 expect(actual.map(m => ({ pool_item_id: m.pool_item_id, source_key: m.source_key, target_key: m.target_snapshot?.lesson?.key, estimated_minutes: m.estimated_minutes })).sort((a,b) => a.source_key.localeCompare(b.source_key))).toEqual([...row.expected].sort((a,b) => a.source_key.localeCompare(b.source_key)))
})
for (const row of fixtures.deadlines) it(`shared deadline: ${row.name}`, () => {
 expect(events.resolveCourseDeadline(row.pool as TaskPoolItem['deadline'],row.course as CourseDeadlinePolicy|null,row.event,row.next,row.phase).due_at).toEqual(row.expected)
})

it('ordinary retry commits bounded catch-up without rebasing caller revisions', async () => {
 const calls: string[] = []
 let remaining=2
 const id = await events.saveCourseWithCatchup(async () => { calls.push('save'); return remaining-- ? null : 'course' }, async () => { calls.push('refresh') })
 expect(id).toBe('course'); expect(calls).toEqual(['save','refresh','save','refresh','save','refresh'])
 let count=0
 await expect(events.saveCourseWithCatchup(async () => { count++; return null },async () => {})).rejects.toThrow('补偿处理中')
 expect(count).toBe(3)
 count=0
 await expect(events.saveCourseWithCatchup(async () => { count++; throw new Error('stale_cursor_revision') },async () => {})).rejects.toThrow('stale_cursor_revision')
 expect(count).toBe(1)
})
it('date-only activation dedupes rules and historical rule kind controls clocks', () => {
 const course={id:'c',user_id:'u',name:'C',subject:'art' as const,created_at:'',course_type:'flexible' as const,automation_enabled_at:'2026-10-26T05:00:00.000Z'}
 const rule={id:'r',user_id:'u',course_id:'c',kind:'flexible' as const,weekday:1,valid_from:'2026-10-01',valid_until:null,start_time:null,end_time:null}
 const dates=events.enumerateCourseEvents(course,[rule,{...rule,id:'duplicate'}],[],'2026-10-19','2026-10-26')
 expect(dates).toHaveLength(1);expect(dates[0].release_at).toBe('2026-10-26T05:00:00.000Z');expect(dates[0].starts_at).toBeNull()
 const timed=events.enumerateCourseEvents(course,[{...rule,kind:'timetabled',start_time:'16:00',end_time:'17:00'}],[],'2026-10-26','2026-10-26')
 expect(timed[0].release_at).toBe('2026-10-26T09:00:00.000Z')
})
it('long-lead projections walk intervening events without moving the live cursor', () => {
 const course={id:'c',user_id:'u',name:'C',subject:'math' as const,created_at:'',auto_advance:true,cursor:{lesson_key:'a',segment_key:null}}
 const candidates=[0,1].map(i=>({...fixtures.matching[0].event,event_key:`event:${i}`,course_id:'c',on_date:`2026-11-${i? '09':'02'}`})) as CourseEvent[]
 const result=events.projectCourseEvents(course,candidates,snapshot,[],[])
 expect(result.events.map(e=>e.event.lesson_snapshot?.lesson?.key)).toEqual(['a','b'])
 expect(course.cursor.lesson_key).toBe('a')
})

it('flexible preview uses a date boundary without fabricating class clocks',()=>{
 const event={on_date:'2026-11-02',starts_at:null,release_at:'2026-11-01T16:00:00.000Z'}
 const pool={...fixtures.matching[0].items[0],trigger:'before_class',trigger_minutes:1440} as TaskPoolItem
 expect(events.resolveActivityWindow(event,pool,null,null,'2026-10-01T00:00:00.000Z','2026-11-01T00:00:00.000Z')).toEqual({release_at:'2026-10-31T16:00:00.000Z',due_at:'2026-11-01T12:30:00.000Z',eligible:true,issues:[]})
 expect(events.resolveActivityWindow(event,pool,null,null,'2026-11-02T01:00:00.000Z','2026-11-02T01:00:00.000Z').eligible).toBe(false)
 expect(events.resolveActivityWindow(event,pool,null,null,'2026-10-01T00:00:00.000Z','2026-11-03T01:00:00.000Z').eligible).toBe(true)
 expect(events.resolveActivityWindow(event,{...pool,trigger_minutes:0},null,null,'2026-10-01T00:00:00.000Z','2026-11-03T01:00:00.000Z').issues).toEqual(['release_after_deadline'])
})

it('includes owned explicit makeup events in projection candidates without duplicate rule identities',()=>{
 const course={id:'c',user_id:'u',name:'C',subject:'art' as const,created_at:''}
 const makeup={...fixtures.matching[0].event,id:'makeup',course_id:'c',user_id:'u',rule_id:null,occurrence_id:null,event_key:'flexible:c:2026-11-02:extra:request',on_date:'2026-11-02',starts_at:null,ends_at:null,release_at:'2026-11-01T16:00:00.000Z',assignment_state:'pending'} as CourseEvent
 expect(events.enumerateCourseEvents(course,[],[],'2026-11-01','2026-11-03',[makeup,{...makeup,id:'foreign',user_id:'other',event_key:'foreign'},{...makeup,id:'cancelled',assignment_state:'cancelled',event_key:'cancelled'}])).toEqual([makeup])
})
