import type { PracticeBinding, PracticeProgression } from './practiceEntries'

const DAY = 86400000
const dateNumber = (day: string) => Date.parse(`${day}T00:00:00Z`)

export function defaultPracticeProgression(day: string): PracticeProgression {
  return { enabled: true, mode: 'daily', amount: 1, weekday: 1, anchorDate: day, skipWeekends: false }
}

export function validatePracticeProgression(rule: PracticeProgression): void {
  const amount = rule.amount ?? 1
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('推进数量须为正整数。')
  const date = dateNumber(rule.anchorDate)
  if (typeof rule.enabled !== 'boolean' || typeof rule.skipWeekends !== 'boolean' ||
    !['daily', 'weekly'].includes(rule.mode) || !Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(rule.anchorDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== rule.anchorDate) {
    throw new Error('课程推进设置无效，请重新设置。')
  }
}

/** Pure date resolution: previews, generation and execution agree without consuming a cursor. */
export function scheduledPracticeRow(binding: PracticeBinding, day: string) {
  const rule = binding.progression
  if (!rule) throw new Error('尚未设置课程推进方式。')
  validatePracticeProgression(rule)
  let anchor = dateNumber(rule.anchorDate)
  if (rule.skipWeekends) {
    while ([0, 6].includes(new Date(anchor).getUTCDay())) anchor += DAY
  }
  const days = Math.max(0, Math.floor((dateNumber(day) - anchor) / DAY))
  if (!Number.isFinite(days)) throw new Error('课程日期无效。')
  const weekday = new Date(anchor).getUTCDay()
  let offset = 0
  if (rule.enabled && rule.mode === 'weekly') {
    const firstAdvance = ((rule.weekday - weekday + 6) % 7) + 1
    offset = days < firstAdvance ? 0 : 1 + Math.floor((days - firstAdvance) / 7)
  } else if (rule.enabled) {
    offset = days
    if (rule.skipWeekends) {
      offset = Math.floor(days / 7) * 5
      for (let i = 1; i <= days % 7; i++) {
        if (![0, 6].includes((weekday + i) % 7)) offset++
      }
    }
  }
  if (!binding.rows.length) return { row: null, rows: [], exhausted: false }
  const start = binding.rows.findIndex((row) => row.id === binding.startId)
  if (start < 0) throw new Error('课程开始项不存在，请重新选择。')
  const amount = rule.amount ?? 1
  const first = start + offset * amount
  const rows = binding.rows.slice(first, first + amount)
  return { row: rows[0] ?? null, rows, exhausted: rows.length === 0 }
}
