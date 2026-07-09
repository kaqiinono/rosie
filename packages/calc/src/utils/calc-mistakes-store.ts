import { createUserSessionStore, supabase } from '@rosie/core'
import type {
  CalcAnswer,
  CalcCategory,
  CalcMistake,
  ErrorTag,
} from '@rosie/core'
import { parseLevelKey } from './calc-helpers'
import { answerFromRow } from './calc-answer'

interface MistakeRow {
  id: string
  signature: string
  display: string
  answer: number
  answer_json: CalcAnswer | null
  level: string
  category: CalcCategory
  last_wrong_at: string
  consecutive_correct: number
  resolved: boolean
  session_no: number | null
  user_answer: string | null
  error_tag: string | null
}

function rowToMistake(r: MistakeRow): CalcMistake {
  return {
    id: r.id,
    signature: r.signature,
    display: r.display,
    answer: answerFromRow(r.answer_json, r.answer),
    level: parseLevelKey(r.level),
    category: r.category,
    lastWrongAt: r.last_wrong_at,
    consecutiveCorrect: r.consecutive_correct,
    resolved: r.resolved,
    sessionNo: r.session_no ?? undefined,
    userAnswer: r.user_answer ?? undefined,
    errorTag: (r.error_tag as ErrorTag | null) ?? null,
  }
}

async function fetchCalcMistakes(userId: string): Promise<CalcMistake[]> {
  const { data } = await supabase
    .from('calc_mistakes')
    .select(
      'id,signature,display,answer,answer_json,level,category,last_wrong_at,consecutive_correct,resolved,session_no,user_answer,error_tag',
    )
    .eq('user_id', userId)
    .order('last_wrong_at', { ascending: false })
  return (data ?? []).map((r) => rowToMistake(r as MistakeRow))
}

export const calcMistakesStore = createUserSessionStore<CalcMistake[]>('calc_mistakes', {
  fetch: fetchCalcMistakes,
  empty: [],
})
