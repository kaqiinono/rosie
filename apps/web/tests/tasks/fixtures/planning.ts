import type {
  PlanningInput,
  TaskDemand,
  CapacityInterval,
} from '../../../../../packages/tasks/src/planning/types'
export const at = (date: string, clock = '18:00') =>
  new Date(`${date}T${clock}:00+08:00`).toISOString()
export const demand = (
  key: string,
  minutes: number,
  release = at('2026-10-29'),
  due = at('2026-11-04'),
): TaskDemand => ({
  key,
  task_id: key,
  course_id: key,
  batch_key: key,
  origin: 'actual',
  release_at: release,
  due_at: due,
  remaining_minutes: minutes,
  priority: 0,
  certainty: 'confirmed',
  source_revision: 1,
})
export const capacity = (
  date: string,
  start: string,
  end: string,
  kind: CapacityInterval['kind'] = 'regular',
): CapacityInterval => ({
  key: date + start,
  start: at(date, start),
  end: at(date, end),
  minutes: (Date.parse(at(date, end)) - Date.parse(at(date, start))) / 60000,
  kind,
})
export const input = (demands: TaskDemand[], windows: CapacityInterval[]): PlanningInput => ({
  input_revision: 1,
  now: at('2026-10-29'),
  horizon_end: at('2026-11-05'),
  demands,
  capacity: windows,
  fixed_blocks: [],
  previous_allocations: [],
  configuration_issues: [],
})
export const sample = () =>
  input(
    [
      demand('math', 100, undefined, at('2026-11-01')),
      demand('chinese', 70, undefined, at('2026-11-03')),
      demand('houhai', 100, at('2026-10-30', '20:00')),
    ],
    [
      capacity('2026-10-29', '18:00', '19:00'),
      capacity('2026-10-30', '19:00', '19:30'),
      capacity('2026-11-02', '19:00', '20:00'),
      capacity('2026-11-03', '19:00', '19:30'),
      capacity('2026-10-31', '10:00', '11:00', 'weekend_reserve'),
      capacity('2026-11-01', '15:00', '16:00', 'weekend_reserve'),
    ],
  )
