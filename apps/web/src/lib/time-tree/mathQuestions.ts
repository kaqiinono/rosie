import { entryHref, type Homework, type PracticeBinding, type PracticeEntryRow } from '@rosie/tasks'
import { TreeConflict } from './engine'
import type { StepPractice } from './practice'
import type { TreeAction, TreeData, WorkStep } from './types'

function entries(practice: StepPractice) {
  return practice.items?.length ? practice.items : (practice.row ? [{ row: practice.row, href: practice.href ?? '' }] : [])
}

export function hasMathQuestions(step: WorkStep) {
  return step.subject === 'math' && !step.flowers && !!step.practice?.row?.values.problemId
}

function assignRows(practice: StepPractice, rows: PracticeEntryRow[], binding: PracticeBinding) {
  const existing = entries(practice)
  if (existing.length === rows.length && practice.exhausted === !rows.length &&
      existing.every((item, index) => item.row.id === rows[index].id)) return
  const items = rows.map(row => ({ row, href: entryHref(binding.path, row.values) }))
  practice.items = items
  practice.row = items[0]?.row ?? null
  practice.href = items[0]?.href ?? null
  practice.exhausted = !items.length
}

export function editMathQuestion(tree: TreeData, step: WorkStep, binding: PracticeBinding | undefined, action: TreeAction) {
  const practice = step.practice
  if (!hasMathQuestions(step) || !practice || step.end || step.skipped || !step.planned)
    throw new TreeConflict('请选择尚未结束的数学作业。')
  const progress: NonNullable<StepPractice['questions']> = practice.questions ??= { completed: [], added: [] }
  const items = entries(practice)
  const rowId = action.rowId
  if (action.questionEdit === 'append') {
    if (!binding || binding.key !== practice.key) throw new TreeConflict('课程配置已变化，请刷新作业。')
    const first = binding.rows.findIndex(row => row.id === practice.row?.id)
    if (first < 0) throw new TreeConflict('当前课程没有这道题，请刷新作业。')
    const used = new Set([...items.map(item => item.row.id), ...(tree.mathQuestionProgress?.[practice.key]?.completed ?? [])])
    const next = binding.rows.slice(first).find(row => row.values.problemId && !used.has(row.id))
    if (!next) throw new TreeConflict('已到本课程的最后一题。')
    practice.items = [...items, { row: next, href: entryHref(binding.path, next.values) }]
    progress.added.push(next.id)
  } else {
    if (!rowId || !items.some(item => item.row.id === rowId)) throw new TreeConflict('题目不属于这份作业。')
    switch (action.questionEdit) {
      case 'complete':
        if (!progress.completed.includes(rowId)) progress.completed.push(rowId)
        break
      case 'undo':
        progress.completed = progress.completed.filter(id => id !== rowId)
        break
      case 'remove':
        if (!progress.added.includes(rowId) || progress.completed.includes(rowId))
          throw new TreeConflict('只能删除本次追加且未完成的题目。')
        progress.added = progress.added.filter(id => id !== rowId)
        practice.items = items.filter(item => item.row.id !== rowId)
        break
      default: throw new TreeConflict('无效的题目操作。')
    }
  }
  for (const peer of tree.steps) {
    if (peer !== step && !peer.end && !peer.skipped && peer.occurrence === step.occurrence && peer.practice?.key === practice.key)
      peer.practice = structuredClone(practice)
  }
}

/** Re-deal only untouched later batches. Started, edited and historical batches retain their snapshots. */
export function planMathQuestions(tree: TreeData, template: Homework) {
  const binding = template.practice_binding
  if (!binding?.progression?.enabled) return
  // Occurrence-based batches are frozen by the homework schedule, not completion.
  if (binding.progression.mode === 'homework') return
  const ledger = tree.mathQuestionProgress?.[binding.key]
  if (!ledger) return
  const first = binding.rows.findIndex(row => row.id === ledger.firstId)
  if (first < 0) return
  const groups = new Map<string, WorkStep[]>()
  for (const step of tree.steps) {
    if (step.flowers || step.practice?.key !== binding.key || !step.occurrence.startsWith(template.id + '/')) continue
    const group = groups.get(step.occurrence) ?? []
    group.push(step)
    groups.set(step.occurrence, group)
  }
  const used = new Set(ledger.completed)
  const pending: WorkStep[][] = []
  for (const peers of groups.values()) {
    if (peers.every(step => step.end || step.skipped)) continue
    if (peers.some(step => step.start || step.end || step.practice?.questions)) {
      const snapshot = peers.find(peer => !peer.end && !peer.skipped)?.practice
      if (snapshot) {
        for (const item of entries(snapshot)) {
          if (!snapshot.questions?.added.includes(item.row.id)) used.add(item.row.id)
        }
      }
    } else if (peers[0].scheduled >= ledger.throughDay) pending.push(peers)
  }
  const rows = binding.rows.slice(first).filter(row => row.values.problemId && !used.has(row.id))
  pending.sort((a, b) => a[0].scheduled.localeCompare(b[0].scheduled) || a[0].occurrence.localeCompare(b[0].occurrence))
  const amount = binding.progression.amount ?? 1
  pending.forEach((peers, index) => {
    const batch = rows.slice(index * amount, (index + 1) * amount)
    for (const peer of peers) assignRows(peer.practice!, batch, binding)
  })
}

export function settleMathQuestions(tree: TreeData, step: WorkStep, template: Homework | null) {
  const practice = step.practice
  if (!practice?.row || !hasMathQuestions(step)) return
  const peers = tree.steps.filter(peer => peer.occurrence === step.occurrence)
  if (peers.some(peer => !peer.end && !peer.skipped)) return
  const cursor = tree.practiceProgress?.[practice.key]
  if (cursor?.activeOccurrence === step.occurrence) cursor.activeOccurrence = null
  if (peers.every(peer => peer.skipped)) return
  const binding = cursor?.binding ?? template?.practice_binding
  if (!binding || binding.key !== practice.key || binding.progression?.enabled === false) return
  const ledgers: NonNullable<TreeData['mathQuestionProgress']> = tree.mathQuestionProgress ??= {}
  const ledger = ledgers[practice.key] ??= { firstId: practice.row.id, throughDay: tree.today, completed: [] }
  // 提前做了未来作业时，保留今天尚未做的较早题目。
  const anchors = new Set([ledger.firstId, practice.row.id])
  for (const pending of tree.steps) {
    if (pending.practice?.key === practice.key && pending.practice.row && !pending.end &&
        !pending.skipped && pending.scheduled >= tree.today) anchors.add(pending.practice.row.id)
  }
  ledger.firstId = binding.rows.find(row => anchors.has(row.id))?.id ?? ledger.firstId
  ledger.throughDay = tree.today
  const completed = new Set(ledger.completed)
  for (const peer of peers) {
    if (peer.end && peer.practice?.key === practice.key) {
      for (const id of peer.practice.questions?.completed ?? []) completed.add(id)
    }
  }
  ledger.completed = [...completed]
  if (cursor) {
    const next = binding.rows.slice(binding.rows.findIndex(row => row.id === ledger.firstId)).find(row => !completed.has(row.id))
    cursor.nextId = next?.id ?? null
    cursor.exhausted = !next
  }
  if (template) planMathQuestions(tree, template)
}
