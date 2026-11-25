import { entryHref, homeworkPeriod, scheduledPracticeRow, type Homework, type PracticeBinding, type PracticeEntryRow } from '@rosie/tasks'
import { dayOf, shift, type TreeData, type WorkStep } from './types'
import { usesWeeklyHomework, weeklyOccurrence } from './weeklyHomework'

export type PracticePreview = {
  name: string
  row: PracticeEntryRow | null
  rows?: PracticeEntryRow[]
  href?: string | null
  items?: { row: PracticeEntryRow; href: string }[]
  exhausted: boolean
  provisional: boolean
}

export function homeworkCardWindow(tree: TreeData, homework: Homework) {
  const { today } = tree
  const period = homeworkPeriod(homework, today)
  if (!period || today > period.end) return null
  const created = dayOf(homework.created_at)
  if (created > today) return null
  if (usesWeeklyHomework(homework)) {
    return { occurrence: weeklyOccurrence(homework.id, period.start), start: period.start, practiceDay: period.start }
  }
  const prefix = `${homework.id}/${homework.cycle}/${period.start}/`
  const count = tree.steps.find(step => step.cycleTarget && step.deadline === period.end && step.occurrence.startsWith(prefix))?.cycleTarget ?? period.count
  const elapsed = Math.round((Date.parse(today) - Date.parse(period.start)) / 86400000)
  const ordinal = Math.ceil((elapsed + 1) * count / period.span) - 1
  const start = shift(period.start, Math.floor(ordinal * period.span / count))
  const practiceDay = [start, created, tree.firstDay].sort().at(-1)!
  return { occurrence: prefix + ordinal, start, practiceDay }
}

/** Management cards and their dialog resolve the same original occurrence, including completed work. */
export function previewHomeworkCard(tree: TreeData, homework: Homework) {
  const binding = homework.practice_binding
  if (!binding) {
    const step = tree.steps.filter(item => item.occurrence.startsWith(`${homework.id}/`) && !item.end && !item.skipped)
      .sort((a, b) => a.scheduled.localeCompare(b.scheduled) || a.id.localeCompare(b.id))[0]
    return step ? { step, content: null, date: step.scheduled, blocked: false } : null
  }
  const window = homeworkCardWindow(tree, homework)
  if (!window) return null
  const peers = tree.steps.filter(step => step.occurrence === window.occurrence)
  const step = peers.find(item => !item.end && !item.skipped) ??
    peers.find(item => item.flowers?.complete) ?? peers.find(item => item.practice) ?? peers[0]
  const saved = step && (step.practice !== undefined || step.end || step.skipped) ? step
    : peers.find(item => item.practice?.key === binding.key)
  const active = !binding.progression && binding.rows.length ? tree.practiceProgress?.[binding.key]?.activeOccurrence : null
  const blocked = !saved && !!active && active !== window.occurrence
  const content = saved ? previewPractice(tree, saved, homework)
    : blocked ? null : previewHomeworkPractice(tree, binding, window.practiceDay, window.occurrence)
  return { step, content, date: step?.scheduled ?? window.practiceDay, blocked }
}

/** A list preview never reserves an occurrence, advances a cursor or changes a snapshot. */
export function previewPractice(tree: TreeData, step: WorkStep, homework?: Homework): PracticePreview | null {
  if (step.subject === 'life') return null
  const saved = step.practice !== undefined
    ? step
    : tree.steps.find((peer) => peer.occurrence === step.occurrence && peer.practice !== undefined &&
      (step.end || step.skipped || peer.practice?.key === homework?.practice_binding?.key))
  if (saved) return saved.practice ? {
    ...saved.practice, rows: saved.practice.items?.map((item) => item.row), provisional: false,
  } : null
  // Never replace a historical task's missing snapshot with today's curriculum.
  if (step.end || step.skipped) return null
  return previewHomeworkPractice(tree, homework?.practice_binding, step.scheduled, step.occurrence)
}

export function previewHomeworkPractice(
  tree: Pick<TreeData, 'practiceProgress'>,
  binding: PracticeBinding | null | undefined,
  day: string,
  occurrence?: string,
): PracticePreview | null {
  if (!binding) return null
  if (binding.progression) {
    // Invalid configuration remains unavailable until corrected; never invent a row.
    try {
      const selection = scheduledPracticeRow(binding, day, occurrence)
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
