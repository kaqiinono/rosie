import { describe, expect, it } from 'vitest'
import { builtInTemplates, templateDraft } from '../../../../packages/tasks/src/defaults'
import { matchTaskPool, resolveActivityOverrides, scopeMatches } from '../../../../packages/tasks/src/taskPool'
import type { CourseEvent, CourseTaskBinding, TaskPoolItem } from '../../../../packages/tasks/src/courseTypes'

const event: CourseEvent = { id: 'event', user_id: 'user', course_id: 'course', rule_id: null, occurrence_id: null, event_key: 'flexible:course:2026-10-29', on_date: '2026-10-29', starts_at: null, ends_at: null, release_at: '2026-10-28T16:00:00Z', lesson_snapshot: { lesson: { key: '5a-u3l2', book: '5A', unit: '3', lesson: 2, title: 'L2', kind: 'english' }, cursor: { lesson_key: '5a-u3l2', segment_key: 'segment-a' }, catalog_version: '1' }, revision: 1, assignment_state: 'pending', completion_state: 'pending', completed_at: null, legacy_confirmation: null }
const pool = (id: string, change: Partial<TaskPoolItem> = {}): TaskPoolItem => ({ ...templateDraft('english'), id, user_id: 'user', created_at: '', name: id, activity_key: id, scope: { kind: 'all' }, progress_mode: 'items', material_selector: { kind: 'auto' }, ...change })
const binding = (item: TaskPoolItem, change: Partial<CourseTaskBinding> = {}): CourseTaskBinding => ({ id: `bind-${item.id}`, user_id: 'user', course_id: 'course', pool_item_id: item.id, enabled: true, scope_override: null, estimated_minutes_override: null, material_override: null, ...change })
const match = (items: TaskPoolItem[], e = event) => matchTaskPool(e, items.map(i => binding(i)), items)

describe('task pool matching', () => {
  it('matches the entire book/unit/lesson scope and teaching segment', () => {
    const items = [pool('correct', { scope: { kind: 'lessons', lesson_keys: ['5a-u3l2'] } }), pool('other-book', { scope: { kind: 'lessons', lesson_keys: ['4a-u3l2'] } }), pool('other-unit', { scope: { kind: 'unit', book: '5A', unit: '4' } }), pool('unit', { scope: { kind: 'unit', book: '5A', unit: '3' } }), pool('segment', { scope: { kind: 'segments', segment_keys: ['segment-a'] } })]
    expect(match(items).map(m => m.pool_item_id)).toEqual(['correct', 'unit', 'segment'])
    expect(scopeMatches({ kind: 'lessons', lesson_keys: ['5a-u3l2'] }, { ...event, lesson_snapshot: null })).toBe(false)
  })
  it('combines common and specific activities, overriding the same logical activity independent of order', () => {
    const common = pool('common', { activity_key: 'spelling' })
    const specific = pool('specific', { activity_key: 'spelling', scope: { kind: 'lessons', lesson_keys: ['5a-u3l2'] }, estimated_minutes: 35 })
    const reading = pool('reading')
    for (const items of [[common, specific, reading], [specific, reading, common]]) {
      const matches = match(items)
      expect(matches).toHaveLength(2)
      expect(matches.find(m => m.activity_key === 'spelling')).toMatchObject({ pool_item_id: 'specific', estimated_minutes: 35 })
      expect(resolveActivityOverrides(matches)).toEqual(matches)
    }
  })
  it('applies binding scope, time and material overrides, and does not match another course or disabled rows', () => {
    const item = pool('one')
    expect(matchTaskPool(event, [binding(item, { estimated_minutes_override: 8, material_override: { kind: 'none' }, scope_override: { kind: 'unit', book: '5A', unit: '3' } })], [item])[0]).toMatchObject({ estimated_minutes: 8, material_selector: { kind: 'none' }, scope: { kind: 'unit', book: '5A', unit: '3' } })
    expect(matchTaskPool(event, [binding(item, { enabled: false })], [item])).toEqual([])
    expect(matchTaskPool(event, [binding(item, { course_id: 'other' })], [item])).toEqual([])
    expect(match([pool('off', { enabled: false })])).toEqual([])
  })
  it('requires explicit bindings, preserving legacy lesson filters without resurrecting disabled selections', () => {
    const item = pool('legacy', { course_id: 'course', lesson_filter: 2 })
    expect(matchTaskPool(event, [], [item])).toEqual([])
    expect(matchTaskPool(event, [binding(item)], [item])).toHaveLength(1)
    expect(matchTaskPool(event, [binding(item, { enabled: false })], [item])).toEqual([])
    expect(match([pool('l3', { lesson_filter: 3 })])).toEqual([])
  })
  it('keeps phase and target separate, normalizing confirmed only for identity', () => {
    const items = [pool('pre', { activity_key: 'read', trigger: 'before_class' }), pool('post', { activity_key: 'read', trigger: 'after_class' }), pool('legacy', { activity_key: 'read', trigger: 'confirmed' }), pool('next', { activity_key: 'read', trigger: 'confirmed', target: 'next' })]
    const matches = matchTaskPool(event, items.map(i => binding(i)), items, { next_lesson_snapshot: event.lesson_snapshot })
    expect(matches).toHaveLength(3)
    expect(new Set(matches.map(m => m.source_key)).size).toBe(3)
    expect(matches.some(m => m.trigger === 'before_class')).toBe(true)
    expect(matches.some(m => m.target === 'next')).toBe(true)
  })
  it('an explicit binding scope replaces the legacy lesson filter and its specificity', () => {
    const l2 = pool('l2', { activity_key: 'dictation', lesson_filter: 2 })
    const l3 = { ...event, lesson_snapshot: { ...event.lesson_snapshot!, lesson: { ...event.lesson_snapshot!.lesson!, key: '5a-u3l3', lesson: 3 } } }
    const matches = matchTaskPool(l3, [binding(l2, { scope_override: { kind: 'lessons', lesson_keys: ['5a-u3l3'] } })], [l2])
    expect(matches).toHaveLength(1)
    expect(matches[0].specificity).toBe(4)
  })
  it('matches next-target activities only against the supplied next snapshot and surfaces a missing target', () => {
    const next = pool('next', { target: 'next', scope: { kind: 'lessons', lesson_keys: ['5a-u3l3'] } })
    const issues: import('../../../../packages/tasks/src/taskPool').TaskPoolMatchIssue[] = []
    expect(matchTaskPool(event, [binding(next)], [next], { issues })).toEqual([])
    expect(issues).toEqual([expect.objectContaining({ code: 'missing_next_lesson', pool_item_id: next.id })])
    const nextSnapshot = { ...event.lesson_snapshot!, lesson: { ...event.lesson_snapshot!.lesson!, key: '5a-u3l3', lesson: 3 } }
    expect(matchTaskPool(event, [binding(next)], [next], { next_lesson_snapshot: nextSnapshot })[0]).toMatchObject({ target: 'next', target_snapshot: nextSnapshot })
    const currentOnly = pool('wrong-next', { target: 'next', scope: { kind: 'lessons', lesson_keys: ['5a-u3l2'] } })
    expect(matchTaskPool(event, [binding(currentOnly)], [currentOnly], { next_lesson_snapshot: nextSnapshot })).toEqual([])
  })
  it('never resolves two distinct events into one activity', () => {
    const item = pool('shared')
    const a = match([item])
    const b = match([item], { ...event, event_key: 'other-event' })
    expect(resolveActivityOverrides([...a, ...b])).toHaveLength(2)
  })
  it('retains missing materials and produces event+activity source keys stable across pool overrides', () => {
    const common = pool('common', { activity_key: 'same:activity' })
    const first = match([common])[0]
    expect(first.material_status).toBe('pending')
    expect(first.estimated_minutes).toBeGreaterThan(0)
    const override = pool('override', { activity_key: common.activity_key, scope: { kind: 'lessons', lesson_keys: ['5a-u3l2'] } })
    expect(match([override])[0].source_key).toBe(first.source_key)
    expect(match([common], { ...event, event_key: 'another-event' })[0].source_key).not.toBe(first.source_key)
  })
  it('leaves weekly and once activities independent, retaining unit_completed trigger', () => {
    expect(match([pool('weekly', { trigger: 'weekly' }), pool('once', { trigger: 'once' })])).toEqual([])
    const unit = pool('unit', { trigger: 'unit_completed', target: 'unit' })
    expect(match([unit])).toEqual([])
    expect(matchTaskPool(event, [binding(unit)], [unit], { completed_unit: { book: '5A', unit: '3' } })[0]).toMatchObject({ trigger: 'unit_completed', target: 'unit' })
    expect(matchTaskPool(event, [binding(unit)], [unit], { completed_unit: { book: '5A', unit: '4' } })).toEqual([])
  })
  it('keeps L3 composition separate from recitation and preserves all workbook defaults', () => {
    const items = builtInTemplates().filter(i => i.subject === 'english').map((i, n) => pool(`default-${n}`, i))
    const e = { ...event, lesson_snapshot: { ...event.lesson_snapshot!, lesson: { ...event.lesson_snapshot!.lesson!, key: '5a-u3l3', lesson: 3 } } }
    const matches = match(items, e)
    expect(matches.filter(m => m.name === 'L3 背诵')).toHaveLength(1)
    expect(matches.filter(m => m.name === 'L3 作文')).toHaveLength(1)
    expect(new Set(matches.map(m => m.activity_key)).size).toBe(matches.length)
    expect(items.filter(i => i.name.includes('workbook')).map(i => i.name)).toEqual(['L1 workbook', 'L2 workbook', 'L3 workbook'])
  })
})
