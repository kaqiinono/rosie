import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Schedule from '../../../../packages/tasks/src/components/Schedule'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { CourseDomainData } from '../../../../packages/tasks/src/courseTypes'
function setup() {
  const data: CourseDomainData = {
    courses: [],
    rules: [],
    course_rules: [],
    events: [],
    catalog_snapshots: [],
    bindings: [],
    pool_items: [],
    exceptions: [],
    occurrences: [],
    templates: [],
    tasks: [],
    day_states: [],
    windows: [],
    blocks: [],
    materials: [],
    progress: [],
    scopes: [],
    reminders: [],
    calendars: [],
    exams: [],
    preferences: [],
    snapshots: [],
  }
  const setAvailability = vi.fn().mockResolvedValue(undefined),
    save = vi.fn()
  const api = { data, setAvailability, save } as unknown as TaskDataApi
  render(
    <TasksContext.Provider
      value={{
        api,
        catalog: { chinese: [], math: [], english: [], loadMathProblems: async () => [] },
        busy: false,
        notify: vi.fn(),
        run: async (f) => {
          try {
            await f()
            return true
          } catch {
            return false
          }
        },
      }}
    >
      <Schedule />
    </TasksContext.Provider>,
  )
  return { setAvailability, save }
}
it('shows missing configuration and manual weekend reserve labels', () => {
  setup()
  expect(screen.getByText('周六 · 备用：待配置')).toBeInTheDocument()
  expect(screen.getByText('周日 · 备用：待配置')).toBeInTheDocument()
})
it('rejects reversed window times without persisting', async () => {
  const { setAvailability } = setup()
  fireEvent.change(screen.getAllByLabelText('开始')[0], { target: { value: '21:00' } })
  fireEvent.click(screen.getByRole('button', { name: '添加时间窗口' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('结束时间必须晚于开始时间'),
  )
  expect(setAvailability).not.toHaveBeenCalled()
})
it('explicit zero saves recurring state without hidden required time fields', async () => {
  const { setAvailability } = setup()
  fireEvent.change(screen.getByLabelText('可用状态'), { target: { value: 'zero' } })
  fireEvent.click(screen.getByRole('button', { name: '保存可用状态' }))
  await waitFor(() => expect(setAvailability).toHaveBeenCalledWith(1, null, 'zero', null, null))
})
it('empty task selection is focused with accessible validation and never saved', () => {
  const { save } = setup()
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  expect(screen.getByLabelText('任务')).toHaveFocus()
  expect(screen.getByLabelText('任务')).toHaveAttribute('aria-invalid', 'true')
  expect(save).not.toHaveBeenCalled()
})
