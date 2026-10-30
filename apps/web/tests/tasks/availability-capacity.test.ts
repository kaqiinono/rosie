import { expect, it } from 'vitest'
import { buildCapacityIntervals } from '../../../../packages/tasks/src/planning/availability'
import { atTime } from '../../../../packages/tasks/src/time'
import type { AvailabilityInput } from '../../../../packages/tasks/src/planning/types'
const d = '2026-10-30'
const input = (): AvailabilityInput => ({
  now: atTime(d, '00:00'),
  horizon_end: atTime('2026-11-01', '00:00'),
  day_states: [],
  windows: [],
  courses: [],
  exams: [],
})
const window = (start = '17:00', end = '20:00') => ({
  id: start,
  user_id: 'u',
  weekday: 5,
  on_date: null,
  start_time: start,
  end_time: end,
})
it('unconfigured days are issues, never all-day capacity; weekends require manual windows', () => {
  const r = buildCapacityIntervals(input())
  expect(r.capacity).toEqual([])
  expect(r.issues.map((x) => x.code)).toContain('availability_unconfigured')
})
it('explicit zero date replaces weekly windows, including absence of any date windows', () => {
  const x = input()
  x.windows = [window()]
  x.day_states = [{ id: 'z', user_id: 'u', weekday: null, on_date: d, state: 'zero' }]
  expect(buildCapacityIntervals(x).capacity).toEqual([])
})
it('union, subtract unavailable intervals, exams, timed courses, ignore cancelled/flexible', () => {
  const x = input()
  x.windows = [
    window(),
    window('18:00', '21:00'),
    { ...window('19:00', '19:30'), unavailable: true },
  ]
  x.courses = [
    { id: 'c', starts_at: atTime(d, '18:00'), ends_at: atTime(d, '18:30'), status: 'scheduled' },
    {
      id: 'cancel',
      starts_at: atTime(d, '17:00'),
      ends_at: atTime(d, '18:00'),
      status: 'cancelled',
    },
    { id: 'free', starts_at: null, ends_at: null, status: 'scheduled' },
  ]
  x.exams = [{ id: 'e', starts_at: atTime(d, '20:00'), ends_at: atTime(d, '20:30') }]
  expect(buildCapacityIntervals(x).capacity.map((x) => x.minutes)).toEqual([60, 30, 30, 30])
})
it('ceil starts and floor ends only after subtraction, respecting seconds without phantom minutes', () => {
  const x = input()
  x.now = '2026-10-30T09:00:01Z'
  x.horizon_end = '2026-10-30T09:03:59Z'
  x.windows = [window()]
  x.exams = [{ id: 'e', starts_at: '2026-10-30T09:01:30Z', ends_at: '2026-10-30T09:02:01Z' }]
  expect(buildCapacityIntervals(x).capacity).toEqual([])
})
it('date windows override entire weekday; weekend manually configured is reserve', () => {
  const x = input()
  x.windows = [
    window(),
    { ...window('19:00', '20:00'), on_date: d },
    { ...window('09:00', '10:00'), weekday: 6 },
  ]
  expect(buildCapacityIntervals(x).capacity.map((c) => [c.minutes, c.kind])).toEqual([
    [60, 'regular'],
    [60, 'weekend_reserve'],
  ])
})

it('weekly explicit zero differs from missing configuration and an unconfigured override blocks recurring capacity', () => {
  const x = input()
  x.windows = [window()]
  x.day_states = [
    { id: 'w', user_id: 'u', weekday: 5, on_date: null, state: 'zero' },
    { id: 's', user_id: 'u', weekday: 6, on_date: null, state: 'zero' },
  ]
  expect(buildCapacityIntervals(x)).toEqual({ capacity: [], issues: [] })
  x.day_states = [{ id: 'd', user_id: 'u', weekday: null, on_date: d, state: 'unconfigured' }]
  expect(buildCapacityIntervals(x).capacity).toEqual([])
  expect(buildCapacityIntervals(x).issues[0].affected_keys).toEqual([d])
})
it('seconds in manual windows and busy intervals never add phantom minutes', () => {
  const x = input()
  x.windows = [window('17:00:01', '17:03:59')]
  x.courses = [{ id: 'c', starts_at: '2026-10-30T09:01:30Z', ends_at: '2026-10-30T09:02:01Z' }]
  expect(buildCapacityIntervals(x).capacity).toEqual([])
})

it('malformed public clock input becomes a window issue rather than a RangeError', () => {
  const x = input()
  x.windows = [window('bad', '20:00')]
  expect(
    buildCapacityIntervals(x).issues.some((i) => i.code === 'availability_invalid_window'),
  ).toBe(true)
})
