import { entryHref, scheduledPracticeRow, type Homework, type PracticeEntryRow } from '@rosie/tasks'
import type { TreeData, WorkStep } from './types'

export type PracticePreview = {
  name: string
  row: PracticeEntryRow | null
  rows?: PracticeEntryRow[]
  href?: string | null
  items?: { row: PracticeEntryRow; href: string }[]
  exhausted: boolean
  provisional: boolean
}

/** A list preview never reserves an occurrence, advances a cursor or changes a snapshot. */
export function previewPractice(tree: TreeData, step: WorkStep, homework?: Homework): PracticePreview | null {
  const saved = step.practice !== undefined
    ? step
    : tree.steps.find((peer) => peer.occurrence === step.occurrence && peer.practice !== undefined &&
      (step.end || step.skipped || peer.practice?.key === homework?.practice_binding?.key))
  if (saved) return saved.practice ? {
    ...saved.practice, rows: saved.practice.items?.map((item) => item.row), provisional: false,
  } : null
  // Never replace a historical task's missing snapshot with today's curriculum.
  if (step.end || step.skipped) return null
  const binding = homework?.practice_binding
  if (!binding) return null
  if (binding.progression) {
    // Invalid configuration remains unavailable until corrected; never invent a row.
    try {
      const selection = scheduledPracticeRow(binding, step.scheduled)
      return {
        name: binding.name, ...selection, provisional: true,
        href: selection.exhausted ? null : entryHref(binding.path, selection.row?.values ?? {}),
        items: selection.rows.map(row => ({ row, href: entryHref(binding.path, row.values) })),
      }
    } catch { return null }
  }
  const cursor = tree.practiceProgress?.[binding.key]
  const source = cursor?.binding ?? binding
  const nextId = cursor ? cursor.nextId : binding.startId
  const row = source.rows.find(item => item.id === nextId) ?? null
  let href: string | null = null
  if (!cursor?.exhausted) {
    try { href = entryHref(source.path, row?.values ?? {}) }
    catch { /* Incomplete templates can still show their saved content. */ }
  }
  return {
    name: source.name, row, href,
    exhausted: cursor?.exhausted ?? false,
    provisional: true,
  }
}
