import type { TaskTimeBlock } from '../types'
import { iso, minute, subtract, union, wholeMinutes } from './intervals'
import type { TaskDemand, CapacityInterval, FixedBlockResult } from './types'
/** Reservations always consume their union, even when obsolete or conflicting. Only legal,
 * non-overlapping future whole minutes reduce demand. No execution/progress is changed. */
export function applyFixedBlocks(
  demands: TaskDemand[],
  capacity: CapacityInterval[],
  blocks: TaskTimeBlock[],
  now: string,
): FixedBlockResult {
  const result: FixedBlockResult = {
    remaining_demands: demands.map((d) => ({ ...d })),
    remaining_capacity: [],
    accepted_allocations: [],
    conflicts: [],
  }
  const clock = Date.parse(now)
  const spans = blocks
    .map((b) => ({ ...b, start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
  const issue = (code: string, ids: string[], detail: string) =>
    result.conflicts.push({ code, affected_keys: ids, detail })
  const future = spans
    .filter(
      (b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start && b.end > clock,
    )
    .map((b) => ({ ...b, start: Math.max(clock, b.start) }))
  const overlapping = new Set<string>()
  for (let i = 0; i < future.length; i++)
    for (let j = i + 1; j < future.length; j++)
      if (future[i].start < future[j].end && future[j].start < future[i].end) {
        overlapping.add(future[i].id)
        overlapping.add(future[j].id)
        issue('fixed_overlap', [future[i].id, future[j].id], '固定安排相互重叠，请调整')
      }
  const available = union(
    capacity.map((c) => ({ start: Date.parse(c.start), end: Date.parse(c.end) })),
  )
  for (const b of spans) {
    if (!Number.isFinite(b.start) || !Number.isFinite(b.end) || b.end <= b.start) {
      issue('fixed_invalid', [b.id], '固定安排时间无效')
      continue
    }
    if (b.end <= clock) {
      issue('fixed_expired', [b.id], '安排已过期；执行进度未自动更新')
      continue
    }
    const start = Math.max(clock, b.start)
    const legal = available.some(
      (c) =>
        c.start <= (b.start < clock ? Math.ceil(clock / minute) * minute : b.start) &&
        c.end >= b.end,
    )
    if (!legal)
      issue('fixed_outside_capacity', [b.id], '安排不在当前可用时间内，请检查课程、考试与窗口')
    const d = result.remaining_demands.find((d) => d.task_id === b.task_id)
    const pieces = wholeMinutes([{ start, end: b.end }])
    let useful = 0
    if (d && (Date.parse(d.release_at) > start || Date.parse(d.due_at) < b.end))
      issue('fixed_task_window', [b.id, d.key], '安排超出任务可开始或截止时间')
    else if (d && legal && !overlapping.has(b.id))
      for (const piece of pieces)
        for (const c of capacity) {
          const s = Math.max(piece.start, Date.parse(c.start)),
            e = Math.min(piece.end, Date.parse(c.end))
          const n = Math.min(Math.max(0, (e - s) / minute), d.remaining_minutes)
          if (n > 0) {
            result.accepted_allocations.push({
              demand_key: d.key,
              start: iso(s),
              end: iso(s + n * minute),
              minutes: n,
              kind: c.kind,
              fixed: true,
            })
            d.remaining_minutes -= n
            useful += n
          }
        }
    if ((!d || d.remaining_minutes === 0) && useful < (b.end - start) / minute)
      issue('fixed_release_suggested', [b.id], '此安排超过剩余任务需要，可手动释放保留时间')
  }
  for (const c of capacity)
    for (const s of wholeMinutes(
      subtract([{ start: Math.max(clock, Date.parse(c.start)), end: Date.parse(c.end) }], spans),
    ))
      result.remaining_capacity.push({
        ...c,
        key: `${c.key}:${s.start}`,
        start: iso(s.start),
        end: iso(s.end),
        minutes: (s.end - s.start) / minute,
      })
  return result
}
