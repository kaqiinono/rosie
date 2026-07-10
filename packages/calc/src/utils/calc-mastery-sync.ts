import { supabase } from '@rosie/core'
import type {
  CalcLevel,
  CalcMistake,
  CalcProblemState,
  CalcQuestion,
  ErrorTag,
} from '@rosie/core'
import { answerToNumeric } from './calc-answer'
import { levelKey } from './calc-helpers'
import { MASTERY_STREAK_K } from './calc-effective-limit'
import { applyAttempt, defaultProblemState } from './calc-apply-attempt'
import { calcMistakesStore } from './calc-mistakes-store'
import {
  calcProblemStateStore,
  problemStateToRow,
  type ProblemStateRecord,
} from './calc-problem-state-store'

export type { ProblemStateRecord }

/** Unresolved mistakes after reconciling against problem_state (deadlock-safe). */
export function unresolvedMistakes(
  mistakes: CalcMistake[],
  states: Map<string, CalcProblemState> | ProblemStateRecord,
): CalcMistake[] {
  const get = (sig: string) =>
    states instanceof Map ? states.get(sig) : states[sig]
  return mistakes.filter((m) => {
    if (m.resolved) return false
    const st = get(m.signature)
    if (st?.status === 'mastered') return false
    return true
  })
}

/**
 * Pure reconcile: fix hanging !resolved when state is mastered, or demote
 * mastered when a newer wrong exists (lastWrongAt > updatedAt).
 */
export function reconcileMistakesAndStates(
  mistakes: CalcMistake[],
  states: ProblemStateRecord,
): { mistakes: CalcMistake[]; states: ProblemStateRecord; dirtySignatures: string[] } {
  const nextMistakes = mistakes.map((m) => ({ ...m }))
  const nextStates: ProblemStateRecord = { ...states }
  const dirty = new Set<string>()

  for (let i = 0; i < nextMistakes.length; i++) {
    const m = nextMistakes[i]
    if (m.resolved) continue
    const st = nextStates[m.signature]
    if (!st || st.status !== 'mastered') continue

    if (m.lastWrongAt > st.updatedAt) {
      nextStates[m.signature] = demoteFromMastered(st)
      dirty.add(m.signature)
    } else {
      nextMistakes[i] = {
        ...m,
        consecutiveCorrect: Math.max(m.consecutiveCorrect, MASTERY_STREAK_K),
        resolved: true,
      }
      dirty.add(m.signature)
    }
  }

  return { mistakes: nextMistakes, states: nextStates, dirtySignatures: [...dirty] }
}

function promoteToMastered(prev: CalcProblemState): CalcProblemState {
  return {
    ...prev,
    consecutiveCorrect: Math.max(prev.consecutiveCorrect, MASTERY_STREAK_K),
    proficiency: Math.max(prev.proficiency, 4),
    status: 'mastered',
    updatedAt: new Date().toISOString(),
  }
}

/** Cross-session repair (reconcile 3b): no applyAttempt runs, so the -2 lives here. */
function demoteFromMastered(prev: CalcProblemState): CalcProblemState {
  return {
    ...prev,
    consecutiveCorrect: 0,
    proficiency: Math.max(0, prev.proficiency - 2),
    status: 'active',
    updatedAt: new Date().toISOString(),
  }
}

/**
 * In-session wrong answer: reset streak / pull out of mastered, but do NOT
 * touch proficiency — the session-finish fold (applyAttempt) is the single
 * owner of the -2 penalty, otherwise one wrong answer costs -4.
 */
export function pullBackFromMastered(prev: CalcProblemState): CalcProblemState {
  return {
    ...prev,
    consecutiveCorrect: 0,
    status: 'active',
    updatedAt: new Date().toISOString(),
  }
}

export type MasteryMutation =
  | {
      kind: 'mistake_added'
      question: CalcQuestion
      sessionNo: number
      userAnswer?: string
      errorTag?: ErrorTag | null
    }
  | {
      kind: 'mistake_correct'
      signature: string
      sessionNo: number
      level: CalcLevel
    }
  | {
      kind: 'main_path_states'
      states: CalcProblemState[]
      sessionNo: number
    }
  | {
      kind: 'reconcile'
    }

type RemoteWrite = () => Promise<unknown>

/**
 * Single side-effect entry: plan → dual patchSessionData (same stack, no await) → remote.
 */
export async function applyMasterySideEffects(
  userId: string,
  mutation: MasteryMutation,
): Promise<void> {
  const prevMistakes = calcMistakesStore.getSessionData(userId) ?? []
  const prevStates = calcProblemStateStore.getSessionData(userId) ?? {}

  let nextMistakes = prevMistakes
  let nextStates: ProblemStateRecord = { ...prevStates }
  const remoteWrites: RemoteWrite[] = []

  if (mutation.kind === 'reconcile') {
    const r = reconcileMistakesAndStates(prevMistakes, prevStates)
    nextMistakes = r.mistakes
    nextStates = r.states
    for (const sig of r.dirtySignatures) {
      const m = nextMistakes.find((x) => x.signature === sig)
      const st = nextStates[sig]
      if (m?.resolved) {
        remoteWrites.push(async () => {
          await supabase
            .from('calc_mistakes')
            .update({
              consecutive_correct: m.consecutiveCorrect,
              resolved: true,
            })
            .eq('user_id', userId)
            .eq('signature', sig)
        })
      }
      if (st) {
        remoteWrites.push(async () => {
          await supabase
            .from('calc_problem_state')
            .upsert(problemStateToRow(st, userId), { onConflict: 'user_id,signature' })
        })
      }
    }
  } else if (mutation.kind === 'mistake_added') {
    const q = mutation.question
    const now = new Date().toISOString()
    const existing = prevMistakes.find((m) => m.signature === q.signature)
    if (existing) {
      nextMistakes = prevMistakes.map((m) =>
        m.signature === q.signature
          ? {
              ...m,
              consecutiveCorrect: 0,
              resolved: false,
              lastWrongAt: now,
              sessionNo: mutation.sessionNo,
              userAnswer: mutation.userAnswer,
              errorTag: mutation.errorTag,
            }
          : m,
      )
    } else {
      nextMistakes = [
        {
          signature: q.signature,
          display: q.display,
          answer: q.answer,
          level: q.level,
          category: q.category,
          lastWrongAt: now,
          consecutiveCorrect: 0,
          resolved: false,
          sessionNo: mutation.sessionNo,
          userAnswer: mutation.userAnswer,
          errorTag: mutation.errorTag,
        },
        ...prevMistakes,
      ]
    }
    const prev = nextStates[q.signature] ?? defaultProblemState(q.signature, q.level)
    nextStates[q.signature] = {
      ...pullBackFromMastered(prev),
      blockId: q.sourceBlockId ?? prev.blockId,
      mixedOpId: q.sourceMixedOpId ?? prev.mixedOpId,
    }
    const st = nextStates[q.signature]
    remoteWrites.push(async () => {
      await supabase.from('calc_mistakes').upsert(
        {
          user_id: userId,
          signature: q.signature,
          display: q.display,
          answer: answerToNumeric(q.answer),
          answer_json: q.answer,
          level: levelKey(q.level),
          category: q.category,
          last_wrong_at: now,
          consecutive_correct: 0,
          resolved: false,
          session_no: mutation.sessionNo,
          user_answer: mutation.userAnswer ?? null,
          error_tag: mutation.errorTag ?? null,
        },
        { onConflict: 'user_id,signature' },
      )
      await supabase
        .from('calc_problem_state')
        .upsert(problemStateToRow(st, userId), { onConflict: 'user_id,signature' })
    })
  } else if (mutation.kind === 'mistake_correct') {
    const existing = prevMistakes.find((m) => m.signature === mutation.signature)
    if (!existing) return
    const nextCount = existing.consecutiveCorrect + 1
    const nextResolved = nextCount >= MASTERY_STREAK_K
    nextMistakes = prevMistakes.map((m) =>
      m.signature === mutation.signature
        ? {
            ...m,
            consecutiveCorrect: nextCount,
            resolved: nextResolved,
            sessionNo: mutation.sessionNo,
          }
        : m,
    )
    if (nextResolved) {
      const prev =
        nextStates[mutation.signature] ??
        defaultProblemState(mutation.signature, mutation.level)
      nextStates[mutation.signature] = promoteToMastered(prev)
    }
    const st = nextStates[mutation.signature]
    remoteWrites.push(async () => {
      await supabase
        .from('calc_mistakes')
        .update({
          consecutive_correct: nextCount,
          resolved: nextResolved,
          session_no: mutation.sessionNo,
        })
        .eq('user_id', userId)
        .eq('signature', mutation.signature)
      if (nextResolved && st) {
        await supabase
          .from('calc_problem_state')
          .upsert(problemStateToRow(st, userId), { onConflict: 'user_id,signature' })
      }
    })
  } else if (mutation.kind === 'main_path_states') {
    for (const s of mutation.states) {
      nextStates[s.signature] = s
      if (s.status === 'mastered') {
        const m = nextMistakes.find((x) => x.signature === s.signature && !x.resolved)
        if (m) {
          nextMistakes = nextMistakes.map((x) =>
            x.signature === s.signature
              ? {
                  ...x,
                  consecutiveCorrect: Math.max(x.consecutiveCorrect, MASTERY_STREAK_K),
                  resolved: true,
                  sessionNo: mutation.sessionNo,
                }
              : x,
          )
          remoteWrites.push(async () => {
            await supabase
              .from('calc_mistakes')
              .update({
                consecutive_correct: MASTERY_STREAK_K,
                resolved: true,
                session_no: mutation.sessionNo,
              })
              .eq('user_id', userId)
              .eq('signature', s.signature)
          })
        }
      }
    }
    remoteWrites.push(async () => {
      const rows = mutation.states.map((st) => problemStateToRow(st, userId))
      await supabase.from('calc_problem_state').upsert(rows, { onConflict: 'user_id,signature' })
    })
  }

  // Same stack, no await between patches (React 18 same-frame)
  calcMistakesStore.patchSessionData(userId, () => nextMistakes)
  calcProblemStateStore.patchSessionData(userId, () => nextStates)

  await Promise.all(remoteWrites.map((w) => w().catch(() => undefined)))
}

export function foldAttempts(
  prev: CalcProblemState,
  attempts: { correct: boolean; timeMs: number; withinLimit: boolean }[],
  sessionNo: number,
  today: string,
): CalcProblemState {
  let state = prev
  for (const a of attempts) {
    state = applyAttempt(state, a, a.withinLimit, sessionNo, today)
  }
  return state
}
