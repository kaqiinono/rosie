import { expect, it } from 'vitest'
import { getTaskExecutionWindow } from '../../../../packages/tasks/src/planning/executionWindow'
const task = {
  id: 't',
  created_at: '2026-10-29T08:00:00Z',
  release_at: '2026-10-30T08:00:00Z',
  due_at: '2026-10-29T09:00:00Z',
  recovery_due_at: null as string | null,
}
const now = '2026-10-30T09:00:00Z'
it('overdue work retains explicit future recovery and persisted release, without changing original metadata', () => {
  const t = { ...task, recovery_due_at: '2026-11-01T09:00:00+00:00' }
  const before = { ...t }
  expect(getTaskExecutionWindow(t, now)).toMatchObject({
    release_at: t.release_at,
    due_at: t.recovery_due_at,
    deadline_source: 'explicit_recovery',
    issue: null,
  })
  expect(t).toEqual(before)
})
it('missing and expired recovery derive Shanghai today23:59, never rewrite persisted fields', () => {
  for (const t of [task, { ...task, recovery_due_at: '2026-10-29T10:00:00Z' }])
    expect(getTaskExecutionWindow(t, now)).toMatchObject({
      due_at: '2026-10-30T15:59:00.000Z',
      deadline_source: 'suggested_recovery',
      issue: null,
    })
  expect(task.recovery_due_at).toBeNull()
  expect(task.due_at).toBe('2026-10-29T09:00:00Z')
})
it('undated tasks get no default and legacy release falls back only when null', () => {
  expect(getTaskExecutionWindow({ ...task, release_at: null, due_at: null }, now)).toMatchObject({
    release_at: task.created_at,
    due_at: null,
    deadline_source: 'missing',
    issue: { code: 'missing_deadline' },
  })
})
it('after today23:59 no silent tomorrow jump; only measured Shanghai midnight rolls the suggestion', () => {
  expect(getTaskExecutionWindow(task, '2026-10-30T15:59:01Z')).toMatchObject({
    due_at: '2026-10-30T15:59:00.000Z',
    issue: { code: 'recovery_window_elapsed' },
  })
  expect(getTaskExecutionWindow(task, '2026-10-30T16:00:00Z')).toMatchObject({
    due_at: '2026-10-31T15:59:00.000Z',
    deadline_source: 'suggested_recovery',
    issue: null,
  })
})
it('future original due stays original even with a recovery field', () => {
  const t = { ...task, due_at: '2026-11-01T09:00:00Z', recovery_due_at: '2026-11-02T09:00:00Z' }
  expect(getTaskExecutionWindow(t, now)).toMatchObject({
    due_at: t.due_at,
    deadline_source: 'original',
  })
})
