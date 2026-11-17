import { describe, expect, it } from 'vitest'
import { EMPTY_HOMEWORK, type Homework } from '../../../packages/tasks/src/homework'
import { homeworkScheduleSnapshot } from '../../../packages/tasks/src/homeworkSchedule'
import { defaultPracticeProgression, scheduledPracticeRow } from '../../../packages/tasks/src/practiceProgression'
import type { PracticeBinding } from '../../../packages/tasks/src/practiceEntries'
import { newTree } from '@/lib/time-tree/engine'
import { schedule } from '@/lib/time-tree/schedule'
import { previewPractice } from '@/lib/time-tree/practicePreview'

function homework(overrides: Partial<Homework> = {}, anchor = '2026-11-16'): Homework {
  const task: Homework = {
    ...EMPTY_HOMEWORK, id: 'homework', user_id: 'child', name: '阅读',
    created_at: `${anchor}T00:00:00Z`, updated_at: `${anchor}T00:00:00Z`, ...overrides,
  }
  task.practice_binding = {
    key: '11111111-1111-4111-8111-111111111111', entryId: 'entry', name: '阅读', path: '/english/{key}',
    rows: Array.from({ length: 12 }, (_, index) => ({ id: String(index + 1), label: `课程 ${index + 1}`, values: { key: String(index + 1) } })),
    startId: '1', progression: {
      ...defaultPracticeProgression(anchor), mode: 'homework', schedule: homeworkScheduleSnapshot(task),
    },
  }
  return task
}

const rowOn = (task: Homework, day: string, occurrence?: string) =>
  scheduledPracticeRow(task.practice_binding!, day, occurrence).row?.id

describe('homework occurrence progression', () => {
  it('advances on weekday assignments only, including a weekend anchor', () => {
    const task = homework({}, '2026-11-21')
    expect(rowOn(task, '2026-11-23')).toBe('1')
    expect(rowOn(task, '2026-11-27')).toBe('5')
    expect(rowOn(task, '2026-11-30')).toBe('6')
  })

  it('groups two course batches into each weekly occurrence and preserves them after rescheduling', () => {
    const task = homework({ cycle: 'weekly', start_weekday: 1, end_weekday: 5, times_per_week: 2 })
    const tree = newTree('2026-11-16')
    schedule(tree, [task], tree.today, '2026-11-27')
    expect(tree.steps.map(step => [step.scheduled, step.practice?.items?.map(item => item.row.id)])).toEqual([
      ['2026-11-16', ['1', '2']], ['2026-11-23', ['3', '4']],
    ])
    const second = tree.steps[1]
    const savedPractice = structuredClone(second.practice)
    second.scheduled = second.planned = '2026-12-03'
    delete second.practice
    expect(previewPractice(tree, second, task)?.rows?.map(row => row.id)).toEqual(['3', '4'])
    schedule(tree, [task], tree.today, '2026-11-27')
    expect(tree.steps).toHaveLength(2)
    expect(second.practice).toEqual(savedPractice)
  })

  it('starts at the active window when saved midway through a period', () => {
    const task = homework({ cycle: 'weekly', start_weekday: 1, end_weekday: 5, times_per_week: 2 }, '2026-11-19')
    expect(rowOn(task, '2026-11-19', 'homework/weekly/2026-11-16/1')).toBe('1')
    expect(rowOn(task, '2026-11-23', 'homework/weekly/2026-11-23/0')).toBe('2')
  })

  it('starts at the next window when saved outside the weekly schedule', () => {
    const task = homework({ cycle: 'weekly', start_weekday: 1, end_weekday: 5, times_per_week: 2 }, '2026-11-21')
    expect(rowOn(task, '2026-11-23')).toBe('1')
    expect(rowOn(task, '2026-11-25')).toBe('2')
  })

  it('advances once per three-week assignment, not once per execution day', () => {
    const task = homework({ cycle: 'three_weekly', start_date: '2026-11-04', times_per_cycle: 1 }, '2026-11-18')
    expect(rowOn(task, '2026-11-24')).toBe('1')
    expect(rowOn(task, '2026-11-25')).toBe('2')
    expect(rowOn(task, '2026-12-15')).toBe('2')
    expect(rowOn(task, '2026-12-16')).toBe('3')
  })

  it('handles calendar months and a shortened final custom period', () => {
    const monthly = homework({ cycle: 'monthly', times_per_cycle: 2 }, '2026-11-20')
    expect(rowOn(monthly, '2026-11-30')).toBe('1')
    expect(rowOn(monthly, '2026-12-01')).toBe('2')
    expect(rowOn(monthly, '2026-12-16')).toBe('3')
    const custom = homework({ cycle: 'custom', start_date: '2026-11-16', end_date: '2026-11-24', times_per_week: 2 })
    expect(['2026-11-16', '2026-11-19', '2026-11-23', '2026-11-24'].map(day => rowOn(custom, day))).toEqual(['1', '2', '3', '4'])
  })

  it('preserves partial final batches and does not wrap exhausted courses', () => {
    const task = homework()
    const binding = task.practice_binding!
    binding.progression!.amount = 5
    expect(scheduledPracticeRow(binding, '2026-11-18').rows.map(row => row.id)).toEqual(['11', '12'])
    expect(scheduledPracticeRow(binding, '2026-11-19').exhausted).toBe(true)
    binding.progression!.enabled = false
    expect(rowOn(task, '2026-12-01')).toBe('1')
  })

  it('updates pending snapshots after a rule switch without regenerating or moving work', () => {
    const task = homework()
    const binding = task.practice_binding as PracticeBinding
    binding.progression!.enabled = false
    const tree = newTree('2026-11-16')
    schedule(tree, [task], tree.today, '2026-11-18')
    const ids = tree.steps.map(step => step.id)
    tree.steps[0].end = tree.today
    tree.steps[2].planned = '2026-11-24'
    const completed = structuredClone(tree.steps[0])
    binding.key = '22222222-2222-4222-8222-222222222222'
    binding.progression!.enabled = true
    schedule(tree, [task], tree.today, '2026-11-18')
    expect(tree.steps.map(step => step.id)).toEqual(ids)
    expect(tree.steps[0]).toEqual(completed)
    expect(tree.steps.slice(1).map(step => step.practice?.row?.id)).toEqual(['2', '3'])
    expect(tree.steps[2].planned).toBe('2026-11-24')
  })

  it('keeps split parts and started flower sessions on the same saved course', () => {
    const daily = homework({ estimated_minutes: 90 })
    const tree = newTree('2026-11-16')
    schedule(tree, [daily], tree.today, '2026-11-17')
    expect(tree.steps.map(step => step.practice?.row?.id)).toEqual(['1', '1', '2', '2'])
    const weekly = homework({ cycle: 'weekly', start_weekday: 1, end_weekday: 5, times_per_week: 1 })
    const flowerTree = newTree('2026-11-16')
    schedule(flowerTree, [weekly], flowerTree.today, flowerTree.today)
    const step = flowerTree.steps[0]
    step.flowers!.availableFrom = '2026-11-17'
    step.scheduled = step.planned = '2026-11-17'
    const before = structuredClone(step.practice)
    weekly.practice_binding!.key = 'changed'
    weekly.practice_binding!.startId = '5'
    schedule(flowerTree, [weekly], flowerTree.today, '2026-11-23')
    expect(step.practice).toEqual(before)
  })
})
