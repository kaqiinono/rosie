import { entryHref, scheduledPracticeRow, validateEntry, type Homework, type PracticeBinding, type PracticeEntryRow } from '@rosie/tasks'
import type { TreeData, WorkStep } from './types'

export interface PracticeProgress {
  binding: PracticeBinding
  nextId: string | null
  exhausted: boolean
  activeOccurrence: string | null
}
export interface StepPractice {
  questions?: { completed: string[]; added: string[] }
  calendarBased?: boolean
  key: string
  name: string
  row: PracticeEntryRow | null
  /** Frozen consecutive content batch. Missing on legacy single-item snapshots. */
  items?: { row: PracticeEntryRow; href: string }[]
  href: string | null
  exhausted: boolean
}

export function calendarPractice(binding: PracticeBinding, day: string, occurrence?: string): StepPractice {
  const { row, rows, exhausted } = scheduledPracticeRow(binding, day, occurrence)
  return {
    key: binding.key, name: binding.name, row: row ? structuredClone(row) : null,
    items: rows.map((item) => ({ row: structuredClone(item), href: entryHref(binding.path, item.values) })),
    href: exhausted ? null : entryHref(binding.path, row?.values ?? {}), exhausted, calendarBased: true,
  }
}

/** Called before task preview / start / untimed completion / manual recording, including early work, inside the garden revision transaction. */
export function bindPractice(tree: TreeData, step: WorkStep, homework?: Homework): void {
  if (step.practice !== undefined) return
  const binding = homework?.practice_binding
  if (!binding) { step.practice = null; return }
  const peers = tree.steps.filter((s) => s.occurrence === step.occurrence && !s.end && !s.skipped)
  const previous = tree.steps.find((s) => s.occurrence === step.occurrence && s.practice?.key === binding.key)
  if (previous) {
    step.practice = previous.practice ? structuredClone(previous.practice) : null
    return
  }
  if (!/^[0-9a-f-]{36}$/i.test(binding.key)) throw new Error('练习配置无效，请重新选择入口')
  validateEntry({ ...binding, subject: homework!.subject })
  if (binding.progression) {
    const snapshot = calendarPractice(binding, step.scheduled, step.occurrence)
    for (const peer of peers) if (peer.practice === undefined) peer.practice = structuredClone(snapshot)
    return
  }
  const progress = tree.practiceProgress ??= {}
  const templatePrefix = step.occurrence.split('/')[0] + '/'
  if (Object.values(progress).some((p) => p.activeOccurrence && p.activeOccurrence !== step.occurrence && p.activeOccurrence.startsWith(templatePrefix)))
    throw new Error('请先完成该作业上一次绑定的练习')
  let cursor = progress[binding.key]
  if (!cursor) {
    if (binding.rows.length && !binding.rows.some((r) => r.id === binding.startId)) throw new Error('练习开始项不存在，请编辑作业重新选择')
    cursor = progress[binding.key] = {
      binding: structuredClone(binding), nextId: binding.startId, exhausted: false, activeOccurrence: null,
    }
  }
  if (cursor.activeOccurrence && cursor.activeOccurrence !== step.occurrence)
    throw new Error('请先完成该作业上一次绑定的练习')
  const row = cursor.binding.rows.find((r) => r.id === cursor.nextId) ?? null
  const exhausted = cursor.exhausted
  const snapshot: StepPractice = {
    key: binding.key, name: binding.name, row: row ? structuredClone(row) : null,
    href: exhausted ? null : entryHref(cursor.binding.path, row?.values ?? {}), exhausted,
  }
  if (!exhausted) cursor.activeOccurrence = step.occurrence
  for (const peer of peers) if (peer.practice === undefined) peer.practice = structuredClone(snapshot)
}

/** All split steps complete = one advance. Skipping releases the reservation without consuming a row. */
export function settlePractice(tree: TreeData, step: WorkStep): void {
  if (!step.practice || step.practice.calendarBased || step.practice.questions) return
  const cursor = tree.practiceProgress?.[step.practice.key]
  if (!cursor || cursor.activeOccurrence !== step.occurrence) return
  const peers = tree.steps.filter((s) => s.occurrence === step.occurrence)
  if (!peers.every((s) => s.end || s.skipped)) return
  cursor.activeOccurrence = null
  if (peers.some((s) => s.skipped) || !cursor.binding.rows.length) return
  const index = cursor.binding.rows.findIndex((r) => r.id === cursor.nextId)
  const next = cursor.binding.rows[index + 1]
  cursor.nextId = next?.id ?? null
  cursor.exhausted = !next
}
