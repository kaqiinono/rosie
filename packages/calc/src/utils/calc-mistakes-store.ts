import { createUserSessionStore, supabase } from '@rosie/core'
import type { CalcAnswer, CalcCategory, CalcMistake, ErrorTag } from '@rosie/core'
import { blockById } from './calc-blocks'
import { evalAst, parseSignature, signatureToDisplay } from './calc-ast'

interface RemediationRow {
  signature: string
  level: number
  block_id: string | null
  mixed_op_id: string | null
  needs_remediation: boolean
  last_wrong_at: string | null
  last_wrong_session_no: number | null
  last_error_tag: string | null
  last_user_answer: string | null
  last_answer_json: CalcAnswer | null
  remediation_correct_count: number
}

function answerFromState(r: RemediationRow): CalcAnswer {
  if (r.last_answer_json) return r.last_answer_json
  try {
    const value = evalAst(parseSignature(r.signature))
    return { kind: 'int', value: Number.isFinite(value) ? value : 0 }
  } catch {
    return { kind: 'int', value: 0 }
  }
}

function categoryFromState(r: RemediationRow): CalcCategory {
  if (r.mixed_op_id) return 'mixed'
  const group = r.block_id ? blockById(r.block_id)?.group : undefined
  return group === 'mul' || group === 'div' ? 'muldiv' : 'addsub'
}

function rowToMistake(r: RemediationRow): CalcMistake {
  return {
    signature: r.signature,
    display: `${signatureToDisplay(r.signature)} = ?`,
    answer: answerFromState(r),
    level: r.level === 99 ? 'C' : r.level,
    category: categoryFromState(r),
    lastWrongAt: r.last_wrong_at ?? '',
    consecutiveCorrect: r.remediation_correct_count,
    resolved: !r.needs_remediation,
    sessionNo: r.last_wrong_session_no ?? undefined,
    userAnswer: r.last_user_answer ?? undefined,
    errorTag: (r.last_error_tag as ErrorTag | null) ?? null,
  }
}

async function fetchCalcMistakes(userId: string): Promise<CalcMistake[]> {
  const { data } = await supabase
    .from('calc_problem_state')
    .select(
      'signature,level,block_id,mixed_op_id,needs_remediation,last_wrong_at,last_wrong_session_no,last_error_tag,last_user_answer,last_answer_json,remediation_correct_count',
    )
    .eq('user_id', userId)
    .not('last_wrong_at', 'is', null)
    .order('last_wrong_at', { ascending: false })
  return (data ?? []).map((r) => rowToMistake(r as RemediationRow))
}

export const calcMistakesStore = createUserSessionStore<CalcMistake[]>('calc_remediation_projection', {
  fetch: fetchCalcMistakes,
  empty: [],
})
