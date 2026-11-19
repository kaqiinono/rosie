import type { Snapshot, TreeData, WorkStep } from './types'

type Identified = { id: string }
type Objects<Item extends Identified> = { put: Item[]; remove: string[] }
type CursorPatch<T> = { put: Record<string, T>; remove: string[] }
type PracticeCursor = NonNullable<TreeData['practiceProgress']>[string]
type MathCursor = NonNullable<TreeData['mathQuestionProgress']>[string]
export type RowChanges = {
  cursors?: { practiceProgress: CursorPatch<PracticeCursor>; mathQuestionProgress: CursorPatch<MathCursor> }
  historyMinutes?: Snapshot['historyMinutes']
  state: Partial<TreeData>
  unset: (keyof TreeData)[]
  steps: WorkStep[]
  stepFields?: (Partial<WorkStep> & { id: string })[]
  held: WorkStep[]
  removed: string[]
  apples: Objects<TreeData['apples'][number]>
  diary: Objects<NonNullable<TreeData['diary']>[number]>
  tomatoSpends: Objects<NonNullable<TreeData['tomatoSpends']>[number]>
}
export type RowReceipt = { revision: number; baseRevision: number; delta?: RowChanges; unchanged?: boolean }

function changes<Item extends Identified>(previous: Item[], next: Item[]): Objects<Item> {
  const before = new Map(previous.map(item => [item.id, item]))
  const put = next.filter(item => {
    const old = before.get(item.id)
    before.delete(item.id)
    return !old || JSON.stringify(old) !== JSON.stringify(item)
  })
  return { put, remove: [...before.keys()] }
}

function accountState(tree: TreeData): Partial<TreeData> {
  const state: Partial<TreeData> = { ...tree }
  delete state.steps
  delete state.weekendExcludedSteps
  delete state.apples
  delete state.tomatoSpends
  delete state.diary
  if (state.practiceProgress) state.practiceProgress = {}
  if (state.mathQuestionProgress) state.mathQuestionProgress = {}
  return state
}

function cursorChanges<T>(before: Record<string, T> = {}, after: Record<string, T> = {}): CursorPatch<T> {
  const put = Object.fromEntries(Object.entries(after).filter(([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value)))
  return { put, remove: Object.keys(before).filter(key => !Object.hasOwn(after, key)) }
}

export function rowChanges(previous: TreeData | null, tree: TreeData): RowChanges {
  const before = previous ? accountState(previous) : {}
  const state = accountState(tree)
  const keys = Object.keys(before) as (keyof TreeData)[]
  const unset = keys.filter(key => !(key in state))
  for (const key of keys) {
    if (JSON.stringify(before[key]) === JSON.stringify(state[key])) delete state[key]
  }
  const steps = changes(previous?.steps ?? [], tree.steps)
  const held = changes(previous?.weekendExcludedSteps ?? [], tree.weekendExcludedSteps ?? [])
  const moved = new Set([...steps.put, ...held.put].map(item => item.id))
  return { state, unset, steps: steps.put, held: held.put, removed: [...steps.remove, ...held.remove].filter(id => !moved.has(id)),
    cursors: { practiceProgress: cursorChanges(previous?.practiceProgress, tree.practiceProgress),
      mathQuestionProgress: cursorChanges(previous?.mathQuestionProgress, tree.mathQuestionProgress) },
    apples: changes(previous?.apples ?? [], tree.apples),
    diary: changes(previous?.diary ?? [], tree.diary ?? []),
    tomatoSpends: changes(previous?.tomatoSpends ?? [], tree.tomatoSpends ?? []) }
}

function merge<Item extends Identified>(items: Item[], patch: Objects<Item>, prepend = false) {
  if (!patch.put.length && !patch.remove.length) return items
  const removed = new Set(patch.remove)
  const updates = new Map(patch.put.map(item => [item.id, item]))
  const kept = items.filter(item => !removed.has(item.id)).map(item => {
    const update = updates.get(item.id)
    updates.delete(item.id)
    return update ?? item
  })
  return prepend ? [...updates.values(), ...kept] : [...kept, ...updates.values()]
}

export function hasRowChanges(delta: RowChanges) {
  return Object.keys(delta.state).length > 0 || delta.unset.length > 0 || delta.steps.length > 0 ||
    delta.held.length > 0 || delta.removed.length > 0 ||
    [delta.apples, delta.diary, delta.tomatoSpends].some(items => items.put.length || items.remove.length) ||
    Object.values(delta.cursors ?? {}).some(items => Object.keys(items.put).length || items.remove.length)
}

export function applyRowChanges(tree: TreeData, delta: RowChanges): TreeData {
  const state = { ...tree, ...delta.state }
  for (const key of delta.unset) Reflect.deleteProperty(state, key)
  if (delta.cursors) {
    if (state.practiceProgress) state.practiceProgress = mergeCursors(tree.practiceProgress, delta.cursors.practiceProgress)
    if (state.mathQuestionProgress) state.mathQuestionProgress = mergeCursors(tree.mathQuestionProgress, delta.cursors.mathQuestionProgress)
  }
  const steps = merge(tree.steps, { put: delta.steps, remove: [...delta.removed, ...delta.held.map(item => item.id)] })
  const fields = new Map(delta.stepFields?.map(patch => [patch.id, patch] as const))
  return { ...state,
    steps: fields.size ? steps.map(step => fields.has(step.id) ? { ...step, ...fields.get(step.id) } : step) : steps,
    weekendExcludedSteps: merge(tree.weekendExcludedSteps ?? [], { put: delta.held, remove: [...delta.removed, ...delta.steps.map(item => item.id)] }),
    apples: merge(tree.apples, delta.apples), diary: merge(tree.diary ?? [], delta.diary, true),
    tomatoSpends: merge(tree.tomatoSpends ?? [], delta.tomatoSpends, true) }
}

function mergeCursors<T>(before: Record<string, T> = {}, patch: CursorPatch<T>): Record<string, T> {
  const entries = { ...before, ...patch.put }
  for (const key of patch.remove) delete entries[key]
  return entries
}
