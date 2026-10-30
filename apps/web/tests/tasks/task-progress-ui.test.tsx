import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskProgressEditor from '../../../../packages/tasks/src/components/TaskProgressEditor'
import MathTaskItems from '../../../../packages/tasks/src/components/MathTaskItems'
import type { TaskInstance } from '../../../../packages/tasks/src/types'
const fixture = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  setCompletion: vi.fn().mockResolvedValue({}),
  setEstimate: vi.fn().mockResolvedValue({}),
  setItemDone: vi.fn().mockResolvedValue({}),
}))
const mathCatalog = {
  math: [{ key: '2-1', title: '第一讲' }],
  loadMathProblems: async () => [
    {
      stable_key: '2-1:homework:2-1-H2',
      key: 'homework:2-1-H2',
      id: '2-1-H2',
      group: 'homework',
      lesson_key: '2-1',
      displayId: 'H2',
      title: '实际题目',
      tags: ['图形'],
      href: '/math/ny/2/1/homework/2-1-H2',
    },
  ],
}
vi.mock('../../../../packages/tasks/src/components/shared', async (original) => ({
  ...(await original<typeof import('../../../../packages/tasks/src/components/shared')>()),
  useTasks: () => ({
    api: { ...fixture, data: { templates: [] } },
    busy: false,
    catalog: mathCatalog,
    run: async (work: () => Promise<unknown>) => {
      await work()
      return true
    },
  }),
}))
const task = {
  id: 'task',
  revision: 2,
  status: 'active',
  subject: 'english',
  progress_mode: 'percentage',
  completion_percent: 25,
  estimated_minutes: 60,
  title: '朗读',
  items: [{ id: 'legacy-id', label: '课文', done: false }],
  selection_state: 'ready',
} as TaskInstance
async function submit(form: HTMLFormElement) {
  await act(async () => {
    fireEvent.submit(form)
  })
}
describe('execution controls', () => {
  it('saves manual percentage and rejects invalid estimates with a visible correction', async () => {
    render(<TaskProgressEditor task={task} />)
    expect(screen.getByText('完成 25% · 剩余 45 分钟')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('完成百分比（0–100）'), { target: { value: '40' } })
    await submit(screen.getByLabelText('完成百分比（0–100）').closest('form')!)
    expect(fixture.setCompletion).toHaveBeenCalledWith(task, 40)
    fireEvent.change(screen.getByLabelText('预计分钟'), { target: { value: '0' } })
    await submit(screen.getByLabelText('预计分钟').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('1–1440')
  })
  it('renames without sending replacement content or resetting existing stable IDs', async () => {
    render(<TaskProgressEditor task={task} />)
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新名称' } })
    await submit(screen.getByLabelText('名称').closest('form')!)
    expect(fixture.save).toHaveBeenLastCalledWith('tasks', {
      id: 'task',
      revision: 2,
      title: '新名称',
    })
  })
  it('defaults pending homework to real homework items, saves stable IDs, and explicitly closes no-homework', async () => {
    render(
      <MathTaskItems
        task={{
          ...task,
          subject: 'math',
          lesson: { key: '2-1', title: '讲次', book: '2', unit: '1', kind: 'lesson' },
          items: [],
          progress_mode: 'items',
          selection_state: 'pending',
        }}
      />,
    )
    expect(await screen.findByText('H2 · 实际题目')).toBeTruthy()
    expect(screen.getByLabelText('题目分组')).toHaveValue('homework')
    fireEvent.click(screen.getByLabelText('H2 · 实际题目'))
    await act(async () => {
      fireEvent.click(screen.getByText('保存所选题目'))
    })
    expect(fixture.save).toHaveBeenLastCalledWith(
      'tasks',
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: '2-1:homework:2-1-H2',
            href: '/math/ny/2/1/homework/2-1-H2',
          }),
        ],
      }),
    )
    await act(async () => {
      fireEvent.click(screen.getByText('本次无作业'))
    })
    expect(fixture.save).toHaveBeenLastCalledWith(
      'tasks',
      expect.objectContaining({ selection_state: 'no_homework' }),
    )
  })
})
