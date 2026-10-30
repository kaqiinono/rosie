import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CourseEditor from '../../../../packages/tasks/src/components/timetable/CourseEditor'
import { parseTimetableJSON, schedulePayload } from '../../../../packages/tasks/src/transfer'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { CourseDomainData } from '../../../../packages/tasks/src/courseTypes'
const empty: CourseDomainData = { courses: [], rules: [], course_rules: [], events: [], catalog_snapshots: [], bindings: [], pool_items: [], exceptions: [], occurrences: [], templates: [], tasks: [], day_states: [], windows: [], blocks: [], materials: [], progress: [], scopes: [], reminders: [], calendars: [], exams: [], preferences: [], snapshots: [] }
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

it('re-edits a pending schedule restored from schedule-only JSON at its target date', async () => {
 const course = { id: 'c', user_id: 'u', created_at: '', name: '数学', subject: 'math' as const, course_type: 'flexible' as const, effective_from: '2099-11-01', rules_revision: 1 }
 const common = { user_id: 'u', course_id: 'c', weekday: 1, valid_until: null }
 const original: CourseDomainData = { ...empty, courses: [course], course_rules: [
 { ...common, id: 'old', kind: 'timetabled', start_time: '09:00', end_time: '10:00', valid_from: '2026-01-01', disabled_from: '2099-11-01' },
 { ...common, id: 'new', kind: 'flexible', start_time: null, end_time: null, valid_from: '2099-11-01' },
 ] }
 const payload = parseTimetableJSON(JSON.stringify(schedulePayload(original)))
 const restored: CourseDomainData = { ...empty, courses: payload.courses.map(c => ({ ...c, user_id: 'u', rules_revision: 1 })), course_rules: payload.rules.map(r => ({ ...r, user_id: 'u', kind: r.kind ?? 'timetabled' })) as CourseDomainData['course_rules'] }
 const save = setup(restored)
 expect(screen.getByLabelText('排课规则生效日')).toHaveValue('2099-11-01')
 expect(screen.getAllByRole('checkbox', { name: '周一' })).toHaveLength(1)
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][1]).toHaveLength(1)
 expect(save.mock.calls[0][1][0]).toMatchObject({ id: 'new', kind: 'flexible' })
 expect(save.mock.calls[0][0].auto_assign).toBe(false)
})
it('persists an explicit course-default deadline and validates its day offset', async () => {
 const save = setup()
 fireEvent.change(screen.getByLabelText(/课程名称/), { target: { value: '阅读' } })
 fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
 fireEvent.click(screen.getByRole('button', { name: '添加上课星期' }))
 fireEvent.change(screen.getByLabelText('课程默认截止策略'), { target: { value: 'next_class' } })
 const days = screen.getByLabelText('自由课程提前天数')
 fireEvent.change(days, { target: { value: '1.5' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 expect(save).not.toHaveBeenCalled()
 expect(days).toHaveAttribute('aria-invalid', 'true')
 fireEvent.change(days, { target: { value: '2' } })
 fireEvent.change(screen.getByLabelText('默认截止时刻'), { target: { value: '19:15' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0].default_deadline).toEqual({ kind: 'next_class', time: '19:15', days: 2, at: null })
})

it('requires a fixed deadline timestamp and persists its Shanghai timezone', async () => {
 const save = setup()
 fireEvent.change(screen.getByLabelText(/课程名称/), { target: { value: '阅读' } })
 fireEvent.change(screen.getByLabelText('课程类型'), { target: { value: 'flexible' } })
 fireEvent.click(screen.getByRole('button', { name: '添加上课星期' }))
 fireEvent.change(screen.getByLabelText('课程默认截止策略'), { target: { value: 'fixed' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 expect(save).not.toHaveBeenCalled()
 expect(screen.getByLabelText('固定截止日期时间')).toHaveFocus()
 fireEvent.change(screen.getByLabelText('固定截止日期时间'), { target: { value: '2099-11-01T19:15' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0].default_deadline).toMatchObject({ kind: 'fixed', at: '2099-11-01T19:15:00+08:00' })
})
it('loads an existing deadline in Shanghai time and can clear it to the system default', async () => {
 const course = { id: 'c', user_id: 'u', created_at: '', name: '阅读', subject: 'other' as const, course_type: 'flexible' as const, rules_revision: 1, default_deadline: { kind: 'fixed' as const, time: '20:30', days: 1, at: '2099-11-01T12:30:00Z' } }
 const save = setup({ ...empty, courses: [course], course_rules: [{ id: 'r', user_id: 'u', course_id: 'c', kind: 'flexible', weekday: 1, start_time: null, end_time: null, valid_from: date, valid_until: null }] })
 expect(screen.getByLabelText('固定截止日期时间')).toHaveValue('2099-11-01T20:30')
 fireEvent.change(screen.getByLabelText('课程默认截止策略'), { target: { value: 'system' } })
 fireEvent.click(screen.getByRole('button', { name: '保存' }))
 await waitFor(() => expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0].default_deadline).toBeNull()
})

it('ordinary edits omit loaded cursor so a background advance cannot be overwritten', async () => {
 const course={id:'c',user_id:'u',name:'C',subject:'art' as const,created_at:'',course_type:'flexible' as const,rules_revision:1,cursor_revision:5,cursor:{lesson_key:'a',segment_key:null}}
 const save=setup({...empty,courses:[course],course_rules:[{id:'r',user_id:'u',course_id:'c',kind:'flexible',weekday:1,valid_from:date,valid_until:null,start_time:null,end_time:null}]})
 fireEvent.change(screen.getByLabelText(/课程名称/),{target:{value:'renamed'}})
 fireEvent.click(screen.getByRole('button',{name:'保存'}))
 await waitFor(()=>expect(save).toHaveBeenCalled())
 expect(save.mock.calls[0][0]).not.toHaveProperty('cursor')
 expect(save.mock.calls[0][0]).not.toHaveProperty('expected_cursor_revision')
})
