import { describe, it, expect } from 'vitest'
import {
  getTaskCompletion,
  getRemainingMinutes,
  mergeTaskSnapshot,
} from '../../../../packages/tasks/src/taskProgress'
import { templateDraft } from '../../../../packages/tasks/src/defaults'
const task = {
  status: 'active' as const,
  progress_mode: 'percentage' as const,
  completion_percent: 25,
  estimated_minutes: 60,
  items: [],
}
describe('task execution progress', () => {
  it('uses integer remaining numerator and real items without rounding completion', () => {
    expect(getRemainingMinutes(task)).toBe(45)
    const items = [
      { id: 'a', done: true },
      { id: 'b', done: false },
      { id: 'c', done: false },
    ]
    expect(
      getRemainingMinutes({ ...task, progress_mode: 'items', estimated_minutes: 20, items }),
    ).toBe(14)
    expect(
      getRemainingMinutes({ ...task, progress_mode: 'items', estimated_minutes: 3, items }),
    ).toBe(2)
    expect(getTaskCompletion({ ...task, progress_mode: 'items', items: [] })).toBe(0)
    expect(getRemainingMinutes({ ...task, status: 'cancelled' })).toBe(0)
    expect(getTaskCompletion({ ...task, status: 'completed' })).toBe(1)
  })
  it('does not infer progress from elapsed clock or display bullets', () => {
    expect(getTaskCompletion({ ...task, items: [{ id: 'a', done: true }] })).toBe(0.25)
    expect(
      getRemainingMinutes({ ...task, selection_state: 'pending', progress_mode: 'items' }),
    ).toBe(60)
  })
  it('keeps higher revision cache snapshots and defaults ordinary activities to percentage', () => {
    expect(
      mergeTaskSnapshot({ revision: 3, title: 'new' }, { revision: 2, title: 'old' }).title,
    ).toBe('new')
    expect(templateDraft('english').progress_mode).toBe('percentage')
    expect(templateDraft('math').progress_mode).toBe('items')
  })
})
