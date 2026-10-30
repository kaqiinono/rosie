import { describe, expect, it } from 'vitest'
import fixtures from '../../../../supabase/tests/fixtures/course-runtime.json'
import {
  projectCourseTasks,
  mergeActualAndForecast,
} from '../../../../packages/tasks/src/planning/forecast'
import {
  buildPlanningInput,
  type UserPlanningSnapshot,
} from '../../../../packages/tasks/src/planning/planningInput'
import { buildTaskPlanningInput } from '../../src/lib/task-planning-input'
import type { ForecastInput } from '../../../../packages/tasks/src/planning/forecast'
import type { TaskInstance } from '../../../../packages/tasks/src/types'
import type { CourseRule, TaskPoolItem } from '../../../../packages/tasks/src/courseTypes'
const now = '2026-10-29T00:00:00.000Z'
function input(): ForecastInput {
  const row = structuredClone(fixtures.matching[0])
  return {
    user_id: 'u',
    now,
    courses: [
      {
        id: 'c',
        user_id: 'u',
        name: 'Course',
        subject: 'art',
        created_at: now,
        auto_assign: true,
        auto_advance: false,
      },
    ],
    rules: [
      {
        id: 'r',
        user_id: 'u',
        course_id: 'c',
        kind: 'timetabled',
        weekday: 5,
        start_time: '16:00',
        end_time: '17:00',
        valid_from: '2026-10-01',
        valid_until: null,
      } as CourseRule,
    ],
    exceptions: [],
    occurrences: [],
    events: [],
    catalog_snapshots: [],
    bindings: [
      {
        id: 'b',
        user_id: 'u',
        course_id: 'c',
        pool_item_id: 'p',
        enabled: true,
        scope_override: null,
        material_override: null,
        estimated_minutes_override: null,
      },
    ],
    pool_items: [
      {
        ...row.items[0],
        id: 'p',
        user_id: 'u',
        activity_key: '听:记/%',
        scope: { kind: 'all' },
        lesson_filter: null,
        trigger: 'after_class',
        target: 'current',
        deadline: { kind: 'next_class', days: 1, time: '20:30', at: null },
        material_selector: { kind: 'none' },
        estimated_minutes: 20,
        enabled: true,
      } as TaskPoolItem,
    ],
  }
}
function snapshot(): UserPlanningSnapshot {
  return {
    ...input(),
    input_revision: 7,
    tasks: [],
    day_states: [],
    windows: [],
    blocks: [],
    exams: [],
    previous_allocations: [],
  }
}
function actual(source_key: string, extra: Partial<TaskInstance> = {}): TaskInstance {
  return {
    id: 't',
    user_id: 'u',
    source_key,
    title: 'T',
    subject: 'art',
    course_id: 'c',
    occurrence_id: null,
    template_id: 'p',
    revision: 2,
    progress_mode: 'percentage',
    completion_percent: 25,
    status: 'active',
    mode: 'checklist',
    items: [],
    lesson: null,
    due_at: '2026-11-06T08:00:00.000Z',
    due_kind: 'next_class',
    due_occurrence_id: null,
    estimated_minutes: 20,
    material_kind: 'none',
    created_at: now,
    release_at: '2026-10-30T09:00:00.000Z',
    material_status: 'not_required',
    ...extra,
  }
}
describe('course task forecast', () => {
  it('keeps Friday after-class release and next-week actual deadline', () => {
    const result = projectCourseTasks(input())
    const d = result.demands[0]
    expect(d.release_at).toBe('2026-10-30T09:00:00.000Z')
    expect(d.due_at).toBe('2026-11-06T08:00:00.000Z')
    expect(d.remaining_minutes).toBe(20)
    expect(result.horizon_end).toBe('2026-11-26T00:00:00.000Z')
  })
  it('formal source replaces forecast byte-for-byte including encoded nonASCII delimiters and completion', () => {
    const s = snapshot()
    s.rules[0].id = '规:则/%'
    const f = projectCourseTasks({ ...s, now }).demands[0]
    s.tasks = [actual(f.key)]
    const built = buildPlanningInput(s, now)
    expect(built.demands.filter((d) => d.key === f.key)).toMatchObject([
      { origin: 'actual', remaining_minutes: 15 },
    ])
    s.tasks[0].status = 'completed'
    expect(buildPlanningInput(s, now).demands.find((d) => d.key === f.key)?.remaining_minutes).toBe(
      0,
    )
    expect(mergeActualAndForecast(built.demands, [f]).filter((d) => d.key === f.key)).toHaveLength(
      1,
    )
  })
  it('honors all automation switch combinations without changing input', () => {
    for (const assign of [false, true])
      for (const advance of [false, true]) {
        const s = input()
        s.courses[0].auto_assign = assign
        s.courses[0].auto_advance = advance
        s.courses[0].catalog_snapshot_id = 'cat'
        s.courses[0].cursor = { lesson_key: 'a', segment_key: null }
        s.catalog_snapshots = [
          {
            id: 'cat',
            user_id: 'u',
            subject: 'art',
            version: 'v',
            source: 'manual',
            progression_mode: 'lesson',
            created_at: now,
            ordered_lessons: ['a', 'b', 'c'].map((key) => ({
              key,
              title: key,
              book: 'b',
              unit: '1',
              kind: 'lesson',
            })),
            teaching_segments: [],
          },
        ]
        const before = JSON.stringify(s)
        const r = projectCourseTasks(s)
        expect(JSON.stringify(s)).toBe(before)
        expect(r.demands.length > 0).toBe(assign)
        expect(r.issues.some((i) => i.code === 'manual_demand_unmodeled')).toBe(!assign)
      }
  })
  it('retains pending estimates and resolves ready auto materials through application adapter', () => {
    const s = snapshot()
    s.pool_items[0].material_selector = { kind: 'auto' }
    s.pool_items[0].progress_mode = 'items'
    const pending = buildTaskPlanningInput({ ...s, material_assets: [], material_links: [] }, now)
    expect(pending.demands[0]).toMatchObject({ remaining_minutes: 20, certainty: 'incomplete' })
    expect(pending.configuration_issues.some((i) => i.code === 'material_pending')).toBe(true)
  })
  it('reports missing scoped catalogs instead of assuming zero work', () => {
    const s = input()
    s.pool_items[0].scope = { kind: 'lessons', lesson_keys: ['unknown'] }
    expect(projectCourseTasks(s).issues.some((i) => i.code === 'missing_catalog')).toBe(true)
  })
  it('preserves original overdue deadline with shared suggested recovery and undated fixed-only backlog', () => {
    const s = snapshot()
    s.tasks = [
      actual('old', { due_at: '2026-10-28T12:00:00Z', release_at: now }),
      actual('undated', { id: 'undated', due_at: null, release_at: now }),
    ]
    s.blocks = [
      {
        id: 'fixed',
        user_id: 'u',
        task_id: 'undated',
        starts_at: '2026-10-29T01:00:00Z',
        ends_at: '2026-10-29T01:10:00Z',
      },
    ]
    const b = buildPlanningInput(s, now)
    expect(b.demands.find((d) => d.key === 'old')).toMatchObject({
      original_due_at: '2026-10-28T12:00:00Z',
      deadline_source: 'suggested_recovery',
      due_at: '2026-10-29T15:59:00.000Z',
    })
    expect(b.demands.some((d) => d.key === 'undated')).toBe(false)
    expect(b.undated_work?.[0]).toMatchObject({
      remaining_minutes: 15,
      commitment_blocks: [{ id: 'fixed' }],
    })
  })
  it('extends through known deadlines but excludes beyond 180 days explicitly', () => {
    const s = snapshot()
    s.tasks = [
      actual('far', { due_at: '2027-01-20T12:00:00Z' }),
      actual('too-far', { id: 'far', due_at: '2027-10-01T12:00:00Z' }),
    ]
    const b = buildPlanningInput(s, now)
    expect(b.horizon_end).toBe('2027-04-27T00:00:00.000Z')
    expect(b.demands.some((d) => d.key === 'too-far')).toBe(false)
    expect(b.configuration_issues.some((i) => i.code === 'outside_forecast_range')).toBe(true)
  })
})

it('changes deadlines with actual revised rules and cancellation exceptions', () => {
  const s = input()
  s.exceptions = [
    {
      id: 'skip',
      user_id: 'u',
      rule_id: 'r',
      original_date: '2026-11-06',
      cancelled: true,
      starts_at: null,
      ends_at: null,
    },
  ]
  expect(
    projectCourseTasks(s).demands.find((d) => d.release_at === '2026-10-30T09:00:00.000Z')?.due_at,
  ).toBe('2026-11-13T08:00:00.000Z')
  s.rules.push({ ...s.rules[0], id: 'replacement', weekday: 1, valid_from: '2026-11-01' })
  expect(
    projectCourseTasks(s).demands.find((d) => d.release_at === '2026-10-30T09:00:00.000Z')?.due_at,
  ).toBe('2026-11-02T08:00:00.000Z')
})
it('counts stored explicit makeup and retained occurrence keys without duplication', () => {
  const s = input()
  const event = {
    ...fixtures.matching[0].event,
    user_id: 'u',
    course_id: 'c',
    id: 'extra',
    event_key: '自由:extra/%',
    rule_id: null,
    on_date: '2026-10-30',
    release_at: '2026-10-30T10:00:00.000Z',
    starts_at: null,
    ends_at: null,
  } as ForecastInput['events'][number]
  s.events = [event]
  const result = projectCourseTasks(s)
  expect(result.demands.some((d) => d.key.includes(encodeURIComponent(event.event_key)))).toBe(true)
  s.events[0] = { ...event, after_processed: true }
  expect(
    projectCourseTasks(s).demands.some((d) => d.key.includes(encodeURIComponent(event.event_key))),
  ).toBe(false)
})
it('uses ready auto materials identically in serialized browser/server application snapshots', () => {
  const s = {
    ...snapshot(),
    material_assets: [{ id: 'asset', status: 'ready' }] as Parameters<
      typeof buildTaskPlanningInput
    >[0]['material_assets'],
    material_links: [
      {
        id: 'link',
        user_id: 'u',
        course_id: 'c',
        asset_id: 'asset',
        scope: { kind: 'all' as const },
        role: 'work',
        sort_order: 0,
      },
    ],
  }
  s.pool_items[0].material_selector = { kind: 'auto' }
  const browser = buildTaskPlanningInput(s, now),
    server = buildTaskPlanningInput(JSON.parse(JSON.stringify(s)), now)
  expect(browser).toEqual(server)
  expect(browser.configuration_issues.some((i) => i.code === 'material_pending')).toBe(false)
  expect(browser.demands[0].certainty).toBe('estimated')
  s.material_assets[0].status = 'archived'
  expect(
    buildTaskPlanningInput(s, now).configuration_issues.some((i) => i.code === 'material_pending'),
  ).toBe(true)
})
it('retains pending actual estimates and suppresses old forecast material issues', () => {
  const s = snapshot()
  const key = projectCourseTasks({ ...s, now }).demands[0].key
  s.tasks = [
    actual(key, {
      selection_state: 'pending',
      material_status: 'pending',
      progress_mode: 'items',
      items: [],
    }),
  ]
  const d = buildPlanningInput(s, now).demands.find((d) => d.key === key)
  expect(d).toMatchObject({ remaining_minutes: 20, origin: 'actual', certainty: 'incomplete' })
})
it('does not call a course without enabled bindings unmodeled manual homework', () => {
  const s = input()
  s.courses[0].auto_assign = false
  s.bindings = []
  expect(projectCourseTasks(s).issues.some((i) => i.code === 'manual_demand_unmodeled')).toBe(false)
})
it('extends to each course next homework cutoff beyond 28 days', () => {
  const s = input()
  s.rules[0].valid_from = '2026-12-01'
  expect(projectCourseTasks(s).horizon_end).toBe('2026-12-11T08:00:00.000Z')
})
it('never exposes movable forecast past covered capacity and marks boundary incompleteness', () => {
  const r = projectCourseTasks(input())
  expect(r.demands.every((d) => Date.parse(d.due_at) <= Date.parse(r.horizon_end))).toBe(true)
  expect(r.issues.some((i) => i.code === 'forecast_boundary')).toBe(true)
})
it('does not silently truncate forecast at runtime preview cap 256', () => {
  const s = input()
  s.rules = []
  s.events = Array.from({ length: 300 }, (_, i) => ({
    ...fixtures.matching[0].event,
    id: `e${i}`,
    user_id: 'u',
    course_id: 'c',
    rule_id: null,
    event_key: `extra:${i}`,
    on_date: '2026-10-30',
    release_at: '2026-10-30T09:00:00.000Z',
    starts_at: null,
    ends_at: null,
  })) as ForecastInput['events']
  s.pool_items[0].deadline = { kind: 'same_day', days: 0, time: '20:30', at: null }
  const r = projectCourseTasks(s)
  expect(r.demands).toHaveLength(300)
  expect(r.runtime_candidate_limit).toBe(256)
  s.events[0].runtime_issues = [{ code: 'preview_projection_limit' }]
  expect(projectCourseTasks(s).issues.some((i) => i.code === 'preview_projection_limit')).toBe(true)
})
it('uses retained occurrence identities for existing rule events', () => {
  const s = input()
  s.occurrences = [
    {
      id: 'occ',
      user_id: 'u',
      course_id: 'c',
      rule_id: 'r',
      original_date: '2026-10-30',
      starts_at: '2026-10-30T08:00:00Z',
      ends_at: '2026-10-30T09:00:00Z',
      status: 'scheduled',
      confirmation: null,
    },
  ]
  s.events = [
    {
      ...fixtures.matching[0].event,
      id: 'saved',
      event_key: 'old:规则/%',
      user_id: 'u',
      course_id: 'c',
      rule_id: 'retired',
      occurrence_id: 'occ',
      on_date: '2026-10-30',
      starts_at: '2026-10-30T08:00:00Z',
      ends_at: '2026-10-30T09:00:00Z',
      release_at: '2026-10-30T09:00:00Z',
    } as ForecastInput['events'][number],
  ]
  const r = projectCourseTasks(s)
  expect(r.demands.filter((d) => d.release_at === '2026-10-30T09:00:00.000Z')).toHaveLength(1)
  expect(r.demands.find((d) => d.release_at === '2026-10-30T09:00:00.000Z')?.key).toContain(
    encodeURIComponent('old:规则/%'),
  )
})
it('reports missing math teaching segments even with auto advance off', () => {
  const s = input()
  s.courses[0].catalog_snapshot_id = 'cat'
  s.courses[0].cursor = { lesson_key: 'math', segment_key: null }
  s.catalog_snapshots = [
    {
      id: 'cat',
      user_id: 'u',
      subject: 'math',
      source: 'manual',
      version: 'v',
      created_at: now,
      progression_mode: 'segment',
      ordered_lessons: [{ key: 'math', title: 'Math', book: 'b', unit: '1', kind: 'lesson' }],
      teaching_segments: [],
    },
  ]
  expect(projectCourseTasks(s).issues.some((i) => i.code === 'missing_segment')).toBe(true)
})
it('pre-class deadline targets upcoming class rather than its next class', () => {
  const s = input()
  s.pool_items[0].trigger = 'before_class'
  s.pool_items[0].trigger_minutes = 1440
  expect(projectCourseTasks(s).demands[0]).toMatchObject({
    release_at: '2026-10-29T08:00:00.000Z',
    due_at: '2026-10-30T08:00:00.000Z',
  })
})
it('keeps formally emitted and projected activities in the same phase batch', () => {
  const s = snapshot()
  const f = projectCourseTasks({ ...s, now }).demands[0]
  s.tasks = [
    actual(f.key, {
      template_snapshot: { trigger: 'after_class' },
      release_at: f.release_at,
      due_at: f.original_due_at!,
    }),
  ]
  expect(buildPlanningInput(s, now).demands.find((d) => d.key === f.key)?.batch_key).toBe(
    f.batch_key,
  )
})
