import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createUserSessionStore } from '../../../../packages/core/src/sessionStore'
import { useTaskData } from '../../../../packages/tasks/src/useTaskData'

const fixture = vi.hoisted(() => ({
  holdOtherReads: false,
  tasksSelected: false,
  releaseOtherReads: null as (() => void) | null,
  otherReads: Promise.resolve(),
}))
const existing = { id: 'existing', revision: 1, title: 'server snapshot', user_id: 'refresh-owner' }
const created = {
  id: 'created-during-refresh',
  revision: 1,
  title: 'new task',
  user_id: 'refresh-owner',
}
vi.mock('@rosie/core', () => ({
  createUserSessionStore,
  useAuth: () => ({ user: { id: 'refresh-owner' } }),
  supabase: {
    rpc: async (name: string) => ({
      data:
        name === 'task_save_execution'
          ? created
          : name === 'task_set_completion'
            ? { ...existing, revision: 3, title: 'newer progress' }
            : null,
      error: null,
    }),
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: async () => {
          if (table === 'task_instances') {
            fixture.tasksSelected = true
            return { data: [existing], error: null }
          }
          if (fixture.holdOtherReads) await fixture.otherReads
          return { data: [], error: null }
        },
      }
      return query
    },
  },
}))

it('retains a task created after the refresh task SELECT but before other tables finish', async () => {
  const { result } = renderHook(() => useTaskData())
  await waitFor(() => expect(result.current.data.tasks.map((t) => t.id)).toEqual(['existing']))
  fixture.holdOtherReads = true
  fixture.tasksSelected = false
  fixture.otherReads = new Promise<void>((resolve) => {
    fixture.releaseOtherReads = resolve
  })
  let refresh: Promise<void>
  await act(async () => {
    refresh = result.current.refresh()
  })
  await waitFor(() => expect(fixture.tasksSelected).toBe(true))
  await act(async () => {
    await result.current.save('tasks', { title: 'new task', subject: 'other' })
  })
  expect(result.current.data.tasks.map((t) => t.id)).toEqual(['existing', created.id])
  await act(async () => {
    await result.current.setCompletion(result.current.data.tasks[0], 50)
  })
  await act(async () => {
    fixture.releaseOtherReads!()
    await refresh!
  })
  expect(result.current.data.tasks.map((t) => t.id)).toEqual(['existing', created.id])
  expect(result.current.data.tasks[0]).toMatchObject({ revision: 3, title: 'newer progress' })
})
