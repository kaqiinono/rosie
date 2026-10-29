import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import CourseDetails from '../../../../packages/tasks/src/components/timetable/CourseDetails'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { CourseDomainData, CourseEvent } from '../../../../packages/tasks/src/courseTypes'
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const lesson = { key: 'math-1', title: '第十讲', book: '二年级', unit: '上册', kind: 'math' }
const course = { id: 'c', user_id: 'u', name: '数学', subject: 'other' as const, created_at: '', catalog_snapshot_id: 'new-catalog', cursor: { lesson_key: 'math-1', segment_key: 'next' } }
function setup(events: CourseEvent[]) {
 const data = { courses: [course], course_rules: [], rules: [], events, catalog_snapshots: [
 { id: 'old-catalog', user_id: 'u', subject: 'math', version: 'old-v', source: 'builtin', progression_mode: 'segment', created_at: '', ordered_lessons: [lesson], teaching_segments: [{ key: 'current', lesson_key: 'math-1', title: '例题 10–20', problem_keys: [] }] },
 { id: 'new-catalog', user_id: 'u', subject: 'math', version: 'new-v', source: 'builtin', progression_mode: 'segment', created_at: '', ordered_lessons: [lesson], teaching_segments: [{ key: 'current', lesson_key: 'math-1', title: '被修改后的范围', problem_keys: [] }, { key: 'next', lesson_key: 'math-1', title: '例题 21–30', problem_keys: [] }] }
 ], materials: [], tasks: [], exams: [], occurrences: [], calendars: [], exceptions: [] } as unknown as CourseDomainData
 render(<TasksContext.Provider value={{ api: { data } as TaskDataApi, catalog: { chinese: [], english: [], math: [], loadMathProblems: async () => [] }, run: async () => true, busy: false, notify: vi.fn() }}><CourseDetails course={course} onClose={vi.fn()} onEdit={vi.fn()} onSelectOccurrence={vi.fn()} /></TasksContext.Provider>)
}
const event = (id: string): CourseEvent => ({ id, user_id: 'u', course_id: 'c', rule_id: null, occurrence_id: null, event_key: id, on_date: '2099-10-29', starts_at: null, ends_at: null, release_at: '2099-10-29T00:00:00+08:00', lesson_snapshot: { lesson, cursor: { lesson_key: 'math-1', segment_key: 'current' }, catalog_version: 'old-v' }, revision: 1, assignment_state: 'assigned', completion_state: 'pending', completed_at: null, legacy_confirmation: null })
describe('immutable current content', () => {
 it('resolves current segment from event catalog version, independently of next cursor/catalog', () => {
  setup([event('current')])
  expect(screen.getByText('本次：二年级 · 上册 · 第十讲 · 例题 10–20')).toBeInTheDocument()
  expect(screen.getByText('下一次：二年级 · 上册 · 第十讲 · 例题 21–30')).toBeInTheDocument()
  expect(screen.queryByText(/被修改后的范围/)).not.toBeInTheDocument()
 })
 it('distinguishes repeated lesson titles by event-owned book and unit', () => {
  const one = event('one'), two = event('two')
  one.lesson_snapshot = { lesson: { key: '5a-u1l1', title: 'Lesson 1', book: '5A', unit: 'Unit 1', kind: 'english' }, cursor: null, catalog_version: null }
  two.lesson_snapshot = { lesson: { key: '5a-u2l1', title: 'Lesson 1', book: '5A', unit: 'Unit 2', kind: 'english' }, cursor: null, catalog_version: null }
  setup([one, two])
  expect(screen.getByRole('option', { name: /5A · Unit 1 · Lesson 1/ })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('选择学习事件'), { target: { value: 'two' } })
  expect(screen.getByText('本次：5A · Unit 2 · Lesson 1')).toBeInTheDocument()
 })
})

it('does not borrow a current segment title when the event catalog is unavailable', () => {
 const legacy = event('legacy')
 legacy.lesson_snapshot = { ...legacy.lesson_snapshot!, catalog_version: 'missing-v' }
 setup([legacy])
 expect(screen.getByText('本次：二年级 · 上册 · 第十讲 · 教学段历史详情不可用')).toBeInTheDocument()
 expect(screen.queryByText(/被修改后的范围/)).not.toBeInTheDocument()
})
