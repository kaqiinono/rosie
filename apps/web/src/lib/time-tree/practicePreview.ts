import { scheduledPracticeRow, type Homework, type PracticeEntryRow } from '@rosie/tasks'
import type { TreeData, WorkStep } from './types'

export type PracticePreview = {
  name: string
  row: PracticeEntryRow | null
  rows?: PracticeEntryRow[]
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
      return { name: binding.name, ...scheduledPracticeRow(binding, step.scheduled), provisional: true }
    } catch { return null }
  }
  const cursor = tree.practiceProgress?.[binding.key]
  const source = cursor?.binding ?? binding
  const nextId = cursor ? cursor.nextId : binding.startId
  return {
    name: source.name,
    row: source.rows.find((row) => row.id === nextId) ?? null,
    exhausted: cursor?.exhausted ?? false,
    provisional: true,
  }
}
