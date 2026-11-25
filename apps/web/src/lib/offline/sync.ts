'use client'

import { settleOfflineCalc } from '@rosie/calc'
import { invalidateSessionStore, supabase, type VocabularyEvidence } from '@rosie/core'
import { isAcceptedSpelling } from '@rosie/english'
import { lessonIdFromProblemId } from '@rosie/math-kit/constants'
import { planAssignmentId } from '@rosie/math-kit/utils/math-helpers'
import { dayOf } from '@/lib/time-tree/types'
import { getOfflineOwner, readOfflineState, updateOfflineState, type OfflineOperation } from './store'

async function settle(owner: string, accessToken: string, item: OfflineOperation) {
  switch (item.kind) {
    case 'calc':
      await settleOfflineCalc(owner, { ...item.draft, day: dayOf(item.finishedAt), finishedAt: item.finishedAt })
      break
    case 'math': {
      const assignment = item.assignment
      const { error } = await supabase.rpc('settle_offline_math_practice', {
        p_operation: item.id, p_problem: item.questionId,
        p_lesson: lessonIdFromProblemId(item.questionId), p_section: item.section,
        p_answer: item.answer, p_correct: item.correct, p_plan: item.planId,
        p_day: item.day, p_assignment: assignment ? planAssignmentId(assignment, item.day) : null,
      })
      if (error) {
        if (error.code === 'PT409') throw new Error('一道数学题的计划已变化，请联网核对。')
        throw error
      }
      break
    }
    case 'english': {
      const attempts: VocabularyEvidence[] = []
      let correctCount = 0
      for (const [index, question] of item.round.questions.entries()) {
        const value = item.answers[index]
        const correct = question.choices ? value === question.answer : isAcceptedSpelling(value, question.word)
        if (correct) correctCount++
        const skill = question.type === 'C' ? 'spelling' : question.type === 'D' ? 'usage' : 'meaning'
        const targetId = skill === 'spelling' ? question.word.spellingGroupId : question.word.practiceSenseId
        if (question.word.id && targetId) attempts.push({
          id: question.id, wordEntryId: question.word.id, targetId, skill, correct, independent: true,
        })
      }
      const { error } = await supabase.rpc('settle_offline_english_weekly', {
        p_operation: item.id, p_plan: item.round.planId, p_day: item.day,
        p_score: Math.round(correctCount / item.round.questions.length * 100), p_attempts: attempts,
      })
      if (error) {
        if (error.code === 'PT409') throw new Error('英语周计划已变化，请联网核对。')
        throw error
      }
      break
    }
    case 'tree': {
      const response = await fetch('/api/time-tree', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'completeOffline', id: item.stepId, revision: item.revision, day: item.day,
          start: item.start, end: item.end, offlineProof: item.proof, protocol: 2, operationId: item.id,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : '生命树暂时无法结算。')
      }
      invalidateSessionStore('time_tree')
      break
    }
  }
}

const running = new Map<string, Promise<string | undefined>>()

export function syncOfflineQueue(owner: string): Promise<string | undefined> {
  const existing = running.get(owner)
  if (existing) return existing
  const flush = async () => {
    if (getOfflineOwner() !== owner || !navigator.onLine) return
    const state = await readOfflineState(owner)
    if (!state?.queue.length) return
    const { data } = await supabase.auth.getSession()
    if (data.session?.user.id !== owner) return '登录原账号后可同步本机记录。'
    let error: string | undefined
    const blocked = new Set<OfflineOperation['kind']>()
    for (const item of state.queue) {
      if (getOfflineOwner() !== owner) return
      if (blocked.has(item.kind)) continue
      try {
        await settle(owner, data.session.access_token, item)
        await updateOfflineState(owner, (current) => ({
          ...current,
          queue: current.queue.filter((operation) => operation.id !== item.id),
          tasks: item.kind === 'tree'
            ? Object.fromEntries(Object.entries(current.tasks).filter(([id]) => id !== item.stepId))
            : current.tasks,
          pack: item.kind === 'tree' && current.pack?.tree ? { ...current.pack,
            tree: { ...current.pack.tree, tasks: current.pack.tree.tasks.map((task) =>
              task.id === item.stepId ? { ...task, completed: true } : task) } } : current.pack,
        }))
        if (item.kind === 'english') {
          invalidateSessionStore('weekly_plans')
          invalidateSessionStore('word_mastery')
        }
        if (item.kind === 'math') invalidateSessionStore('math_weekly_plans')
        if (item.kind === 'calc') invalidateSessionStore('calc_sessions_today')
      } catch (reason) {
        blocked.add(item.kind)
        if (reason instanceof Error && item.kind !== 'calc') error = reason.message
        else error ??= '有记录暂未同步，已保留在本机。'
      }
    }
    return error
  }
  const operation = Promise.resolve(navigator.locks
    ? navigator.locks.request('rosie-offline-sync:' + owner, flush)
    : flush()).finally(() => running.delete(owner))
  running.set(owner, operation)
  return operation
}
