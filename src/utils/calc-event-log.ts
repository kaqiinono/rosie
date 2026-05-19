import { supabase } from '@/lib/supabase'
import type { CalcLevel } from './type'

export type CalcEventType =
  | 'level_up'
  | 'level_down'
  | 'review_pass'
  | 'review_fail'
  | 'assault_mode_on'
  | 'forced_problem'

function levelToInt(level: CalcLevel | null): number | null {
  if (level === null) return null
  return level === 'C' ? 99 : level
}

export interface CalcEventInput {
  userId: string
  type: CalcEventType
  level?: CalcLevel | null
  signature?: string | null
  detail?: Record<string, unknown>
}

/** Fire-and-forget event-log write. Failures are swallowed (best-effort audit). */
export async function writeCalcEvent(input: CalcEventInput): Promise<void> {
  try {
    await supabase.from('calc_event_log').insert({
      user_id: input.userId,
      event_type: input.type,
      level: levelToInt(input.level ?? null),
      signature: input.signature ?? null,
      detail: input.detail ?? null,
    })
  } catch {
    /* ignore */
  }
}
