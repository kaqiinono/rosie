import { supabase, type CalcQuestion, type CalcSettings, type QuestionLogEntry } from '@rosie/core'
import { checkAnswer } from './calc-answer'
import { presentationKeyOf } from './calc-concept-key'
import { coverageUniverse } from './calc-coverage'
import { coinReward } from './calc-helpers'
import { PROBLEM_STATE_SELECT_COLS, rowToProblemState, type ProblemStateRow } from './calc-problem-state-store'
import { settleCalcSession } from './calc-server-api'
import { resolveTargetSec } from './calc-session-policy'
import { CALC_SETTLEMENT_SCHEMA_VERSION } from './calc-settlement-contract'
import { foldCalcSettlement } from './calc-settlement-fold'

type OfflineCalcResult = {
  id: string
  day: string
  startedAt: string
  finishedAt: string
  settings: CalcSettings
  questions: CalcQuestion[]
  answers: { value: string; ms: number }[]
}

export async function settleOfflineCalc(owner: string, result: OfflineCalcResult) {
  const { data: runtime, error: runtimeError } = await supabase.from('calc_user_runtime')
    .select('state_revision,last_session_no').eq('user_id', owner).maybeSingle()
  if (runtimeError) throw runtimeError
  const signatures = [...new Set(result.questions.map((question) => question.signature))]
  const { data, error } = await supabase.from('calc_problem_state').select(PROBLEM_STATE_SELECT_COLS)
    .eq('user_id', owner).in('signature', signatures)
  if (error) throw error

  const lastIndex = new Map<string, number>()
  const occurrences = new Map<string, number>()
  let coinsEarned = 0
  let streak = 0
  let maxStreak = 0
  let challengeCorrect = 0
  const questionLog = result.questions.map((question, index): QuestionLogEntry => {
    const answer = result.answers[index]
    if (!answer) throw new Error('口算练习还未完成。')
    const ok = checkAnswer(answer.value, question.answer)
    streak = ok ? streak + 1 : 0
    maxStreak = Math.max(maxStreak, streak)
    if (ok) {
      coinsEarned += coinReward(question, streak)
      if (question.isChallenge) challengeCorrect++
    }
    const previous = lastIndex.get(question.signature)
    const occurrence = (occurrences.get(question.signature) ?? 0) + 1
    lastIndex.set(question.signature, index)
    occurrences.set(question.signature, occurrence)
    const sourceId = question.sourceBlockId ?? question.sourceMixedOpId
    const explicitSeconds = question.sourceBlockId
      ? result.settings.selectedBlocks.find((item) => item.id === sourceId)?.seconds
      : result.settings.mixedOps.find((item) => item.id === sourceId)?.seconds
    const presentationKey = presentationKeyOf(question)
    const targetSec = resolveTargetSec({ explicitSeconds, sourceId, presentationKey })
    const coverage = question.sourceBlockId ? coverageUniverse(question.sourceBlockId) : null
    const curriculumIndex = coverage?.indexOf(question.signature) ?? null
    return {
      key: question.sourceBlockId ? 'block:' + question.sourceBlockId
        : question.sourceMixedOpId ? 'mixed:' + question.sourceMixedOpId : 'unknown',
      ms: answer.ms, finalMs: answer.ms, ok, finallyOk: ok, display: question.display,
      signature: question.signature, level: question.level, isChallenge: question.isChallenge,
      firstAnswer: answer.value, finalAnswer: answer.value, answerJson: question.answer,
      targetSec: result.settings.timedAnswerEnabled ? targetSec : null,
      withinLimit: ok && answer.ms <= targetSec * 1_000,
      presentationKey, occurrenceInSession: occurrence, intentionalRepeat: false,
      previousDistance: previous === undefined ? null : index - previous - 1,
      selectionReason: question.selectionReason, sourceBlockId: question.sourceBlockId,
      sourceMixedOpId: question.sourceMixedOpId, evidenceKind: 'independent',
      curriculumVersion: curriculumIndex !== null ? coverage?.version : undefined,
      curriculumIndex: curriculumIndex ?? undefined,
    }
  })
  const previous = new Map((data as ProblemStateRow[]).map((row) => [row.signature, rowToProblemState(row)]))
  const problemStates = foldCalcSettlement(questionLog, previous, (runtime?.last_session_no ?? 0) + 1, result.day, true)
  return settleCalcSession(owner, {
    idempotencyKey: result.id,
    expectedRevision: runtime?.state_revision ?? 0,
    clientSchemaVersion: CALC_SETTLEMENT_SCHEMA_VERSION,
    session: {
      date: result.day, startedAt: result.startedAt, finishedAt: result.finishedAt,
      mode: 'daily', coinsEarned, maxStreak, challengeCorrect,
      topLevel: result.questions.some((question) => question.level === 'C')
        ? 'C' : Math.max(...result.questions.map((question) => Number(question.level))),
      questionTimesMs: result.answers.map((answer) => answer.ms), questionLog,
    },
    problemStates,
  })
}
