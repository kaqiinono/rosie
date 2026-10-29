import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CourseLearningSettings from '../../../../packages/tasks/src/components/timetable/CourseLearningSettings'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { CourseInput, TaskCatalogAdapter } from '../../../../packages/tasks/src/types'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import { createTaskCatalogAdapter } from '../../src/components/tasks/taskCatalogAdapters'
const ready = { status: 'ready' as const, complete: true, error: null }
const lesson = { key: '2-10', title: '第十讲', book: '二年级', unit: '10', kind: 'math', order: 0 }
const problems = [
 { key: 'lesson:real-A', stable_key: '2-10:lesson:real-A', id: 'real-A', lesson_key: '2-10', group: 'lesson' as const, displayId: '10', order: 0, title: '例题十', tags: [] },
 { key: 'homework:real-B', stable_key: '2-10:homework:real-B', id: 'real-B', lesson_key: '2-10', group: 'homework' as const, displayId: '10', order: 0, title: '作业十', tags: [] },
]
function Harness({ adapter }: { adapter: TaskCatalogAdapter }) {
 const [value, setValue] = useState<CourseInput>({ name: '学校数学', subject: 'math' })
 const [pending, setPending] = useState('')
 return <TasksContext.Provider value={{ api: { user: { id: 'user' } } as TaskDataApi, catalog: adapter, notify: vi.fn(), busy: false, run: async () => true }}><CourseLearningSettings value={value} onChange={patch => setValue(v => ({ ...v, ...patch }))} onPendingChange={setPending} /><output aria-label="课程草稿">{JSON.stringify(value)}</output><output aria-label="未准备提示">{pending}</output></TasksContext.Provider>
}
const draft = () => JSON.parse(screen.getByLabelText('课程草稿').textContent!) as CourseInput
function open() { fireEvent.click(screen.getByText('配置目录范围与教学段')) }
describe('course catalog preparation', () => {
 it('prepares a manual school math directory without accessing a question bank', async () => {
  const loadMathProblems = vi.fn(async () => { throw new Error('must not load builtin bank') })
  render(<Harness adapter={createTaskCatalogAdapter({ chinese: [], english: [], math: [], readiness: {}, loadMathProblems })} />)
  open()
  fireEvent.click(screen.getByRole('button', { name: '添加目录项' }))
  fireEvent.change(screen.getByLabelText('第 1 项标题'), { target: { value: '小数' } })
  fireEvent.change(screen.getByLabelText('第 1 项教材'), { target: { value: '学校数学' } })
  fireEvent.click(screen.getByRole('button', { name: '准备目录' }))
  await waitFor(() => expect(draft().catalog_snapshot?.ordered_lessons[0].title).toBe('小数'))
  expect(draft().catalog_snapshot).toMatchObject({ subject: 'math', source: 'manual', progression_mode: 'lesson', teaching_segments: [] })
  expect(draft().cursor?.lesson_key).toMatch(/^manual:/)
  expect(loadMathProblems).not.toHaveBeenCalled()
 })
 it('persists only selected real problem keys and explicit closure, without deriving group order', async () => {
  render(<Harness adapter={createTaskCatalogAdapter({ chinese: [], english: [], math: [lesson], readiness: { math: ready }, loadMathProblems: async () => problems })} />)
  open()
  fireEvent.change(screen.getByLabelText('目录来源'), { target: { value: 'builtin' } })
  fireEvent.change(screen.getByLabelText('教材 / 阶段'), { target: { value: '二年级' } })
  fireEvent.click(screen.getByRole('checkbox', { name: '二年级 · 10 · 第十讲' }))
  fireEvent.change(screen.getByLabelText('教学段所属讲次'), { target: { value: '2-10' } })
  fireEvent.click(screen.getByRole('button', { name: '加载本讲题目' }))
  await screen.findByRole('checkbox', { name: '10 · 例题十' })
  expect(screen.queryByRole('checkbox', { name: '10 · 作业十' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: '10 · 例题十' }))
  fireEvent.change(screen.getByLabelText('教学段名称'), { target: { value: '例题 10' } })
  fireEvent.click(screen.getByRole('checkbox', { name: '本讲最后一段' }))
  fireEvent.click(screen.getByRole('button', { name: '添加教学段' }))
  fireEvent.click(screen.getByRole('button', { name: '准备目录' }))
  await waitFor(() => expect(draft().catalog_snapshot?.teaching_segments).toHaveLength(1))
  expect(draft().catalog_snapshot?.teaching_segments[0]).toMatchObject({ lesson_key: '2-10', title: '例题 10', problem_keys: ['2-10:lesson:real-A'], completes_lesson: true })
 })
 it('allows preparing future missing segments without manufacturing a current cursor', async () => {
  render(<Harness adapter={createTaskCatalogAdapter({ chinese: [], english: [], math: [lesson], readiness: { math: ready }, loadMathProblems: async () => problems })} />)
  open(); fireEvent.change(screen.getByLabelText('目录来源'), { target: { value: 'builtin' } })
  fireEvent.change(screen.getByLabelText('教材 / 阶段'), { target: { value: '二年级' } })
  fireEvent.click(screen.getByRole('checkbox', { name: '二年级 · 10 · 第十讲' }))
  fireEvent.click(screen.getByRole('button', { name: '准备目录' }))
  await waitFor(() => expect(draft().catalog_snapshot).toBeTruthy())
  expect(draft().cursor).toBeNull()
  expect(screen.getByText(/到达缺口时将暂停推进/)).toHaveAttribute('role', 'status')
 })
})
