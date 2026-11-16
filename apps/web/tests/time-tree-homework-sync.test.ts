import { describe, expect, it } from 'vitest'
import type { PracticeBinding } from '@rosie/tasks'
import { EMPTY_HOMEWORK, type Homework } from '../../../packages/tasks/src/homework'
import { act, newTree, roll } from '@/lib/time-tree/engine'
import { schedule } from '@/lib/time-tree/schedule'

function template(): Homework {
  return {
    ...EMPTY_HOMEWORK, id: 'homework', user_id: 'child', name: '旧作业',
    created_at: '2026-11-16T00:00:00Z', updated_at: '2026-11-16T00:00:00Z',
    practice_binding: {
      key: 'old', entryId: 'entry', name: '阅读', path: '/english/{key}',
      rows: [{ id: 'a', label: '旧内容', values: { key: 'a' } }], startId: 'a',
      progression: { enabled: false, mode: 'daily', amount: 1, weekday: 1, anchorDate: '2026-11-16', skipWeekends: false },
    },
  }
}

describe('homework content synchronization', () => {
  it('pops life tasks once without timing, grants rewards and settles their fruit', () => {
    const tree = newTree('2026-11-16')
    const life: Homework = { ...template(), subject: 'life', estimated_minutes: 90 }
    schedule(tree, [life], tree.today, '2026-11-22')
    expect(tree.steps).toHaveLength(1)
    const step = tree.steps[0]
    act(tree, { kind: 'pop', id: step.id }, '2026-11-16T04:00:00Z')
    expect(step).toMatchObject({ start: null, end: '2026-11-16', popped: true, slot: null, sun: 1, water: 1 })
    const before = structuredClone(tree)
    act(tree, { kind: 'pop', id: step.id }, '2026-11-16T04:00:01Z')
    expect(tree.sun).toBe(before.sun)
    expect(tree.water).toBe(before.water)
    expect(tree.diary).toEqual(before.diary)
    roll(tree, '2026-11-17')
    expect(tree.apples).toHaveLength(1)
    expect(tree.apples[0].kind).toBe('life')
    schedule(tree, [life], tree.today, '2026-11-23')
    expect(tree.steps.filter(s => !s.end)).toHaveLength(1)
    expect(tree.steps.find(s => !s.end)?.scheduled).toBe('2026-11-17')
  })

  it('expires unpopped life tasks without reward and renews daily until disabled', () => {
    const tree = newTree('2026-11-20')
    const life: Homework = { ...template(), subject: 'life', cycle: 'weekly', start_weekday: 1, end_weekday: 5, times_per_week: 1 }
    schedule(tree, [life], tree.today, '2026-11-26')
    expect(tree.steps).toHaveLength(1)
    roll(tree, '2026-11-21')
    expect(tree.steps).toHaveLength(0)
    expect(tree.sun).toBe(0)
    expect(tree.water).toBe(0)
    expect(tree.diary).toEqual([])
    schedule(tree, [life], tree.today, '2026-11-27')
    expect(tree.steps).toHaveLength(1)
    expect(tree.steps[0].scheduled).toBe('2026-11-21')
    expect(() => act(tree, { kind: 'start', id: tree.steps[0].id }, '2026-11-21T04:00:00Z')).toThrow()
    schedule(tree, [], tree.today, '2026-11-27')
    expect(tree.steps).toHaveLength(0)
  })
  it('updates unfinished and running content without changing completed work or execution records', () => {
    const tree = newTree('2026-11-16')
    const homework = template()
    schedule(tree, [homework], '2026-11-16', '2026-11-18')
    const [completed, running, pending] = tree.steps
    completed.end = '2026-11-16'
    const completedBefore = structuredClone(completed)
    running.start = '2026-11-16T02:00:00Z'
    running.planNote = '保留本次备注'
    pending.planned = '2026-11-20'
    homework.name = '新作业'
    homework.notes = '新的说明'
    homework.practice_binding = {
      ...homework.practice_binding as PracticeBinding, key: 'new',
      rows: [{ id: 'b', label: '新内容', values: { key: 'b' } }], startId: 'b',
    }

    schedule(tree, [homework], '2026-11-16', '2026-11-18')

    expect(tree.steps).toHaveLength(3)
    expect(completed).toEqual(completedBefore)
    expect(running).toMatchObject({ name: '新作业', notes: '新的说明', start: '2026-11-16T02:00:00Z', planNote: '保留本次备注', practice: { key: 'new', row: { id: 'b' } } })
    expect(pending).toMatchObject({ planned: '2026-11-20', practice: { row: { id: 'b' } } })
    const after = structuredClone(tree)
    schedule(tree, [homework], '2026-11-16', '2026-11-18')
    expect(tree).toEqual(after)
  })

  it('releases an obsolete legacy reservation when unfinished work changes to calendar content', () => {
    const tree = newTree('2026-11-16')
    const homework = template()
    schedule(tree, [homework], tree.today, tree.today)
    const step = tree.steps[0]
    step.practice = { ...step.practice!, key: 'legacy', calendarBased: false }
    tree.practiceProgress = { legacy: { binding: homework.practice_binding!, nextId: 'a', exhausted: false, activeOccurrence: step.occurrence } }
    schedule(tree, [homework], tree.today, tree.today)
    expect(tree.practiceProgress.legacy).toMatchObject({ activeOccurrence: null, nextId: 'a', exhausted: false })
    expect(step.practice).toMatchObject({ key: 'old', calendarBased: true })
  })

  it('keeps completed split parts unchanged when the remaining part changes subject and content', () => {
    const tree = newTree('2026-11-16')
    const homework = { ...template(), estimated_minutes: 90 }
    schedule(tree, [homework], tree.today, tree.today)
    const [done, pending] = tree.steps
    done.end = tree.today
    const before = structuredClone(done)
    homework.name = '新任务'
    homework.subject = 'english'
    homework.priority = 'P0'
    homework.practice_binding = null
    schedule(tree, [homework], tree.today, tree.today)
    expect(done).toEqual(before)
    expect(pending).toMatchObject({ name: '新任务（2/2）', subject: 'english', priority: 'P0', practice: null, minutes: 30 })
  })

  it('adds a newly saved template without duplicating existing occurrences', () => {
    const tree = newTree('2026-11-16')
    const homework = template()
    schedule(tree, [homework], tree.today, tree.today)
    const added = { ...homework, id: 'added', name: '新增作业' }
    schedule(tree, [homework, added], tree.today, tree.today)
    schedule(tree, [homework, added], tree.today, tree.today)
    expect(tree.steps.map(step => step.name)).toEqual(['旧作业', '新增作业'])
  })
})
