import { atTime, dateAfter, localDate } from '../time'
import { iso, minute, subtract, wholeMinutes } from './intervals'
import type { AvailabilityInput, CapacityBuildResult } from './types'
/** Date overrides replace the complete recurring configuration, including explicit zero. */
export function buildCapacityIntervals(input: AvailabilityInput): CapacityBuildResult {
  const result: CapacityBuildResult = { capacity: [], issues: [] }
  const now = Date.parse(input.now),
    end = Date.parse(input.horizon_end)
  if (!Number.isFinite(now) || !Number.isFinite(end) || end <= now)
    return {
      capacity: [],
      issues: [{ code: 'invalid_horizon', affected_keys: [], detail: '请设置有效的预测时间范围' }],
    }
  const busy = [
    ...input.courses.filter(
      (c) =>
        c.status !== 'cancelled' && c.assignment_state !== 'cancelled' && c.starts_at && c.ends_at,
    ),
    ...input.exams,
  ].map((c) => ({ start: Date.parse(c.starts_at!), end: Date.parse(c.ends_at!) }))
  for (
    let date = localDate(new Date(now));
    Date.parse(atTime(date, '00:00')) < end;
    date = dateAfter(date, 1)
  ) {
    const weekday = new Date(atTime(date, '12:00')).getUTCDay()
    const override = input.day_states.find((s) => s.on_date === date)
    const dateWindows = input.windows.filter((w) => w.on_date === date)
    const state =
      override ?? input.day_states.find((s) => s.on_date === null && s.weekday === weekday)
    const selected =
      override || dateWindows.length
        ? dateWindows
        : input.windows.filter((w) => w.on_date === null && w.weekday === weekday)
    // Legacy windows stay readable before/without migration backfill.
    const status =
      override?.state ??
      (dateWindows.length
        ? dateWindows.every((w) => w.unavailable)
          ? 'zero'
          : 'configured'
        : (state?.state ?? (selected.some((w) => !w.unavailable) ? 'configured' : 'unconfigured')))
    if (status === 'unconfigured') {
      result.issues.push({
        code: 'availability_unconfigured',
        affected_keys: [date],
        detail: `${date} 待配置可用时间`,
      })
      continue
    }
    if (status === 'zero') continue
    const spans = selected.map((w) => ({
      ...w,
      start: Date.parse(atTime(date, w.start_time)),
      end: Date.parse(atTime(date, w.end_time)),
    }))
    if (!spans.some((w) => !w.unavailable))
      result.issues.push({
        code: 'availability_empty',
        affected_keys: [date],
        detail: `${date} 已标为配置时段，但没有可用窗口`,
      })
    for (const w of spans)
      if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end <= w.start)
        result.issues.push({
          code: 'availability_invalid_window',
          affected_keys: [w.id],
          detail: '结束时间必须晚于开始时间',
        })
    const free = wholeMinutes(
      subtract(
        spans
          .filter((w) => !w.unavailable)
          .map((w) => ({ start: Math.max(now, w.start), end: Math.min(end, w.end) })),
        [...busy, ...spans.filter((w) => w.unavailable)],
      ),
    )
    result.capacity.push(
      ...free.map((s) => ({
        key: `${date}:${s.start}`,
        start: iso(s.start),
        end: iso(s.end),
        minutes: (s.end - s.start) / minute,
        kind: weekday === 0 || weekday === 6 ? ('weekend_reserve' as const) : ('regular' as const),
      })),
    )
  }
  return result
}
