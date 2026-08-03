import type { ChinesePlanQuizType, ChineseRoadmapPlanStatus } from '../../utils/chineseRoadmapPlanTypes'

export const PLAN_QUIZ_TYPE_LABELS: Record<ChinesePlanQuizType, string> = {
  recognize: '认字',
  stroke: '笔顺',
  phrase: '词语检测',
  passage: '阅读题',
  'pinyin-write': '看拼写字',
}

/** Labels for plan quiz types + session-only phases stored in run.byType. */
export const PLAN_RUN_TYPE_LABELS: Record<string, string> = {
  ...PLAN_QUIZ_TYPE_LABELS,
  poems: '古诗词',
  accumulation: '日积月累',
}

export function planRunTypeLabel(type: string): string {
  return PLAN_RUN_TYPE_LABELS[type] ?? type
}

export type PlanRunByTypeRow = {
  key: string
  label: string
  correct: number
  total: number
  /** 0–100 integer when total > 0 */
  accuracyPct: number | null
}

/** Ordered breakdown rows for admin run history / Today records. */
export function formatPlanRunByType(
  byType: Record<string, { total: number; correct: number }> | null | undefined,
): PlanRunByTypeRow[] {
  if (!byType) return []
  return Object.entries(byType).map(([key, stats]) => {
    const total = stats?.total ?? 0
    const correct = stats?.correct ?? 0
    return {
      key,
      label: planRunTypeLabel(key),
      correct,
      total,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    }
  })
}

export function planStatusLabel(status: ChineseRoadmapPlanStatus): string {
  switch (status) {
    case 'active':
      return '进行中'
    case 'paused':
      return '已暂停'
    case 'completed':
      return '已完成'
    case 'archived':
      return '已归档'
    default:
      return status
  }
}

export function formatPlanQuizTypes(types: ChinesePlanQuizType[]): string {
  if (types.length === 0) return '未选题型'
  return types.map((t) => PLAN_QUIZ_TYPE_LABELS[t] ?? t).join(' · ')
}

export function fmtPlanDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function clampK(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(10, Math.max(1, Math.trunc(value)))
}
