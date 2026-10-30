import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Schedule from '../../../../packages/tasks/src/components/Schedule'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { TaskInstance, TaskTimeBlock } from '../../../../packages/tasks/src/types'
import { atTime } from '../../../../packages/tasks/src/time'
import type { CourseDomainData } from '../../../../packages/tasks/src/courseTypes'
function setup(overrides: Partial<CourseDomainData> = {}, rejectSave = false) {
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
    ...overrides,
  }
  const setAvailability = vi.fn().mockResolvedValue(undefined),
    save = vi.fn(async (_key: string, row: Partial<TaskTimeBlock>) => {
      if (rejectSave) throw new Error('安排已变化，请重新检查')
      const next = { ...row, id: row.id ?? 'inserted', user_id: 'u' } as TaskTimeBlock
      data.blocks = [...data.blocks.filter((b) => b.id !== next.id), next]
      return next
    })
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
  return { setAvailability, save, data }
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

const moveDate = '2099-01-05',
  targetDate = '2099-01-06'
function arrangementData(): Partial<CourseDomainData> {
  const task: TaskInstance = {
    id: 't',
    user_id: 'u',
    title: 'Reading',
    subject: 'other',
    occurrence_id: null,
    template_id: null,
    source_key: 'manual:t',
    mode: 'checklist',
    lesson: null,
    due_kind: 'fixed',
    due_occurrence_id: null,
    material_kind: 'general',
    status: 'pending',
    progress_mode: 'percentage',
    completion_percent: 0,
    estimated_minutes: 60,
    items: [],
    created_at: atTime(moveDate, '00:00'),
    release_at: atTime(moveDate, '16:00'),
    recovery_due_at: null,
    due_at: '2099-01-06T10:00:00+00:00',
    revision: 1,
    course_id: null,
  }
  return {
    tasks: [task],
    blocks: [
      {
        id: 'original',
        user_id: 'u',
        task_id: 't',
        starts_at: atTime(moveDate, '17:00'),
        ends_at: atTime(moveDate, '18:00'),
      },
    ],
    windows: [1, 2].map((weekday) => ({
      id: String(weekday),
      user_id: 'u',
      weekday,
      on_date: null,
      start_time: '17:00',
      end_time: '20:00',
    })),
  }
}
it('cross-day move preserves the original identity and accepts an equivalent offset-form deadline exactly', async () => {
  const { save, data } = setup(arrangementData())
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.click(screen.getByRole('button', { name: '移动安排' }))
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: targetDate } })
  expect(screen.getAllByLabelText('开始')[1]).toHaveValue('17:00')
  fireEvent.click(screen.getByRole('button', { name: '保存移动后的安排' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      'blocks',
      expect.objectContaining({
        id: 'original',
        starts_at: atTime(targetDate, '17:00'),
        ends_at: atTime(targetDate, '18:00'),
      }),
    ),
  )
  expect(data.blocks).toHaveLength(1)
  expect(data.blocks[0].id).toBe('original')
  expect(data.blocks[0].starts_at).toBe(atTime(targetDate, '17:00'))
})
it('server-rejected cross-day update retains the original block and editable target draft', async () => {
  const { save, data } = setup(arrangementData(), true),
    before = { ...arrangementData().blocks![0] }
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.click(screen.getByRole('button', { name: '移动安排' }))
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: targetDate } })
  fireEvent.click(screen.getByRole('button', { name: '保存移动后的安排' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(screen.getByRole('alert')).toHaveTextContent('安排已变化')
  expect(data.blocks).toEqual([before])
  expect(screen.getByRole('button', { name: '保存移动后的安排' })).toBeInTheDocument()
})
it('block ending at an offset-form deadline compares numeric instants', async () => {
  const fixture = arrangementData()
  fixture.blocks = []
  fixture.tasks![0].due_at = '2099-01-05T10:00:00+00:00'
  const { save } = setup(fixture)
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.change(screen.getByLabelText('任务'), { target: { value: 't' } })
  fireEvent.change(screen.getAllByLabelText('开始')[1], { target: { value: '17:00' } })
  fireEvent.change(screen.getAllByLabelText('结束')[1], { target: { value: '18:00' } })
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
})

it('persisted release rejects early blocks even when legacy creation time would allow them', async () => {
  const fixture = arrangementData()
  fixture.blocks = []
  fixture.tasks![0].release_at = atTime(moveDate, '17:30')
  const { save } = setup(fixture)
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.change(screen.getByLabelText('任务'), { target: { value: 't' } })
  fireEvent.change(screen.getAllByLabelText('开始')[1], { target: { value: '17:00' } })
  fireEvent.change(screen.getAllByLabelText('结束')[1], { target: { value: '18:00' } })
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('任务可开始和截止时间'))
  expect(save).not.toHaveBeenCalled()
})
it('overdue task can use its future explicit recovery deadline without changing original due', async () => {
  const fixture = arrangementData()
  fixture.blocks = []
  fixture.tasks![0].due_at = '2020-01-01T00:00Z'
  fixture.tasks![0].recovery_due_at = '2099-01-05T10:00:00+00:00'
  const { save, data } = setup(fixture)
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.change(screen.getByLabelText('任务'), { target: { value: 't' } })
  fireEvent.change(screen.getAllByLabelText('开始')[1], { target: { value: '17:00' } })
  fireEvent.change(screen.getAllByLabelText('结束')[1], { target: { value: '18:00' } })
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(data.tasks[0].due_at).toBe('2020-01-01T00:00Z')
})
it('explicit undated block is a local commitment with no invented task deadline', async () => {
  const fixture = arrangementData()
  fixture.blocks = []
  fixture.tasks![0].due_at = null
  fixture.tasks![0].release_at = atTime(moveDate, '17:30')
  const { save, data } = setup(fixture)
  fireEvent.change(screen.getByLabelText('安排日期'), { target: { value: moveDate } })
  fireEvent.change(screen.getByLabelText('任务'), { target: { value: 't' } })
  fireEvent.change(screen.getAllByLabelText('开始')[1], { target: { value: '17:00' } })
  fireEvent.change(screen.getAllByLabelText('结束')[1], { target: { value: '18:00' } })
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('任务可开始和截止时间'))
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(screen.getAllByLabelText('开始')[1], { target: { value: '17:30' } })
  fireEvent.click(screen.getByRole('button', { name: '安排这一段时间' }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(data.tasks[0].due_at).toBeNull()
})
