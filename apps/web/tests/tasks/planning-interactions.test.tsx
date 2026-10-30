import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import type { TaskDataApi } from '../../../../packages/tasks/src/useTaskData'
import type { TaskInstance } from '../../../../packages/tasks/src/types'
import { TasksContext } from '../../../../packages/tasks/src/components/shared'
import PlanningDashboard from '../../../../packages/tasks/src/components/planning/PlanningDashboard'
import RecoveryTargetEditor from '../../../../packages/tasks/src/components/planning/RecoveryTargetEditor'
import { input, result } from './planning-view-fixture'
const task: TaskInstance = {
  id: 'task-1',
  title: '数学练习',
  user_id: 'owner',
  subject: 'math',
  occurrence_id: null,
  template_id: null,
  source_key: 'manual',
  mode: 'checklist',
  lesson: null,
  due_kind: 'fixed',
  due_occurrence_id: null,
  material_kind: 'homework',
  course_id: 'math',
  due_at: '2026-10-29T12:00:00Z',
  release_at: '2026-10-28T12:00:00Z',
  created_at: '2026-10-28T12:00:00Z',
  recovery_due_at: null,
  revision: 2,
  status: 'active',
  progress_mode: 'percentage',
  completion_percent: 25,
  estimated_minutes: 60,
  items: [],
}
const accept = vi.fn(),
  recover = vi.fn(),
  read = vi.fn(),
  settings = vi.fn()
function mount(child: React.ReactNode, expires = '2099-01-01T00:00:00Z') {
  const api = {
    data: {
      courses: [
        { id: 'math', name: '数学' },
        { id: 'english', name: '英语' },
      ],
      tasks: [task],
      planning: {
        stale: false,
        settings: { tight_ratio: 0.2 },
        background: { configured: false },
        snapshot: {
          input_revision: 4,
          computed_at: input.now,
          horizon_end: input.horizon_end,
          next_recompute_at: expires,
          input,
          result: { allow_weekend: result, regular_only: result },
          risks: {},
        },
        alerts: [
          {
            batch_key: 'batch-math',
            reason: 'capacity',
            risk: { status: 'insufficient', unallocated_minutes: 20 },
            read_at: null,
            resolved_at: null,
          },
        ],
      },
    },
    acceptPlan: accept,
    setRecoveryDue: recover,
    readPlanningAlert: read,
    setPlanningSettings: settings,
    requestPlanning: vi.fn(),
  } as unknown as TaskDataApi
  return render(
    <TasksContext.Provider
      value={{
        api,
        catalog: {} as never,
        busy: false,
        notify: vi.fn(),
        run: async (work) => {
          await work()
          return true
        },
      }}
    >
      {child}
    </TasksContext.Provider>,
  )
}
afterEach(() => vi.clearAllMocks())
describe('planning interactions', () => {
  it('adopts only explicit actual selection, leaves forecast unselectable and persists threshold', async () => {
    mount(<PlanningDashboard />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes[0]).not.toBeChecked()
    expect(boxes[1]).toBeDisabled()
    fireEvent.click(boxes[0])
    fireEvent.click(screen.getByRole('button', { name: '固定所选 1 段' }))
    await waitFor(() => expect(accept).toHaveBeenCalledWith(4, [result.allocations[0]]))
    fireEvent.change(screen.getByLabelText(/余量紧张阈值/), { target: { value: '0.3' } })
    await waitFor(() => expect(settings).toHaveBeenCalledWith(0.3))
  })
  it('expired snapshots cannot remain safe or be adopted, and read does not resolve', async () => {
    mount(<PlanningDashboard />, '2020-01-01T00:00:00Z')
    expect(screen.getByText(/以下为历史参考/)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '标为已读' }))
    await waitFor(() => expect(read).toHaveBeenCalledWith('batch-math', 'capacity'))
    expect(screen.getByText(/已读不等于解决/)).toBeInTheDocument()
  })
  it('saves an explicit future recovery target with expected revision, retaining original overdue text', async () => {
    mount(<RecoveryTargetEditor task={task} now={Date.parse(input.now)} />)
    const form = screen.getByRole('button', { name: '保存补做目标' }).closest('form')!
    fireEvent.change(within(form).getByLabelText(/补做日期/), { target: { value: '2099-01-02' } })
    fireEvent.submit(form)
    await waitFor(() =>
      expect(recover).toHaveBeenCalledWith('task-1', '2099-01-02T15:59:00.000Z', 2),
    )
    expect(screen.getByText(/原截止/)).toHaveTextContent('仍标记逾期')
  })
})
