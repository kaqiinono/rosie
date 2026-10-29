import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CourseEditor from '../../../../packages/tasks/src/components/timetable/CourseEditor'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { CourseDomainData } from '../../../../packages/tasks/src/courseTypes'
const empty: CourseDomainData = { courses: [], rules: [], course_rules: [], events: [], catalog_snapshots: [], bindings: [], pool_items: [], exceptions: [], occurrences: [], templates: [], tasks: [], windows: [], blocks: [], materials: [], progress: [], scopes: [], reminders: [], calendars: [], exams: [], preferences: [], snapshots: [] }
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
const date = '2099-10-29'
function setup(data = empty, course = data.courses[0]) {
 const saveCourse = vi.fn().mockResolvedValue('new-course')
 const api = { data, saveCourse } as unknown as TaskDataApi
 render(<TasksContext.Provider value={{ api, catalog: { chinese: [], english: [], math: [], loadMathProblems: async () => [] }, busy: false, notify: vi.fn(), run: vi.fn() }}><CourseEditor course={course} date={date} onClose={vi.fn()} /></TasksContext.Provider>)
 return saveCourse
}
describe('atomic course editor', () => {
 it('saves a flexible weekday rule without clocks and automation off', async () => {
  const save = setup()
  fireEvent.change(screen.getByLabelText(/课程名称/), { target: { value: '校内数学' } })
  fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
  fireEvent.click(screen.getByRole('button', { name: '添加上课星期' }))
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(save.mock.calls[0][0]).toMatchObject({ name: '校内数学', course_type: 'flexible', auto_assign: false, auto_advance: false, bindings: [] })
  expect(save.mock.calls[0][1][0]).toMatchObject({ kind: 'flexible', weekday: 1, start_time: null, end_time: null })
 })
 it('requires at least one weekday even for flexible courses', () => {
  setup()
  fireEvent.change(screen.getByLabelText(/课程名称/), { target: { value: '阅读' } })
  fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
 })
})

it('loads the pending target rule and preserves draft when the effective date changes', async () => {
 const course = { id: 'c', user_id: 'u', created_at: '', name: '数学', subject: 'math' as const, course_type: 'flexible' as const, effective_from: '2099-11-01', rules_revision: 2 }
 const common = { user_id: 'u', course_id: 'c', weekday: 1, valid_until: null }
 const save = setup({ ...empty, courses: [course], course_rules: [
  { ...common, id: 'old', kind: 'timetabled', start_time: '09:00', end_time: '10:00', valid_from: '2026-01-01', disabled_from: '2099-11-01' },
  { ...common, id: 'new', kind: 'flexible', start_time: null, end_time: null, valid_from: '2099-11-01' },
 ] })
 expect(screen.getByLabelText('排课规则生效日')).toHaveValue('2099-11-01')
 expect(screen.getAllByRole('checkbox', { name: '周一' })).toHaveLength(1)
 fireEvent.click(screen.getByRole('checkbox', { name: '周二' }))
 fireEvent.change(screen.getByLabelText('排课规则生效日'), { target: { value: '2099-12-01' } })
 expect(screen.getByRole('checkbox', { name: '周二' })).toBeChecked()
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'new', weekday: 1 }), expect.objectContaining({ weekday: 2 })]))
 expect(save.mock.calls[0][2]).toBe('2099-12-01')
})

it('blocks fractional binding estimates with accessible validation before atomic persistence', async () => {
 const item = { id: 'pool', user_id: 'u', name: '练习', subject: null, trigger: 'after_class', estimated_minutes: 20, enabled: true, scope: { kind: 'all' }, material_selector: { kind: 'auto' } } as CourseDomainData['pool_items'][number]
 const save = setup({ ...empty, pool_items: [item] })
 fireEvent.change(screen.getByLabelText(/课程名称/), { target: { value: '阅读' } })
 fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
 fireEvent.click(screen.getByRole('button', { name: '添加上课星期' }))
 fireEvent.click(screen.getByRole('checkbox', { name: '练习' }))
 const input = screen.getByLabelText('预计分钟（留空使用 20 分钟）')
 fireEvent.change(input, { target: { value: '1.5' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 expect(save).not.toHaveBeenCalled()
 expect(input).toHaveAttribute('aria-invalid', 'true')
 expect(input).toHaveFocus()
 fireEvent.change(input, { target: { value: '25' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0].bindings).toEqual([expect.objectContaining({ pool_item_id: 'pool', estimated_minutes_override: 25 })])
})

it('preserves original reminder and descriptive fields when scheduling a type conversion', async () => {
 const course = { id: 'c', user_id: 'u', created_at: '', name: '英语', subject: 'english' as const, course_type: 'timetabled' as const, rules_revision: 1, reminder_minutes: 15, teacher: '王老师', location: '三楼', notes: '带课本', credits: 2, color: '#123456' }
 const save = setup({ ...empty, courses: [course], course_rules: [{ id: 'r', user_id: 'u', course_id: 'c', kind: 'timetabled', weekday: 1, start_time: '09:00', end_time: '10:00', valid_from: date, valid_until: null }] })
 fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0]).toMatchObject({ reminder_minutes: 15, teacher: '王老师', location: '三楼', notes: '带课本', credits: 2, color: '#123456' })
})
