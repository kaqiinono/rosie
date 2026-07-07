'use client'

import { useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { advanceStage, createUserSessionStore, regressStage, supabase } from '@rosie/core'
import type { ProblemMasteryMap, WordMasteryInfo } from '@rosie/core'

async function fetchProblemMastery(userId: string): Promise<ProblemMasteryMap> {
  const { data } = await supabase
    .from('problem_mastery')
    .select('problem_key, correct, incorrect, last_seen, stage, next_review_date, is_hard')
    .eq('user_id', userId)
  const record: ProblemMasteryMap = {}
  for (const row of data ?? []) {
    record[row.problem_key] = {
      correct: row.correct ?? 0,
      incorrect: row.incorrect ?? 0,
      lastSeen: row.last_seen ?? '',
      stage: row.stage ?? undefined,
      nextReviewDate: row.next_review_date ?? undefined,
      isHard: row.is_hard ?? undefined,
    }
  }
  return record
}

export const mathProblemMasteryStore = createUserSessionStore<ProblemMasteryMap>(
  'math_problem_mastery',
  {
    fetch: fetchProblemMastery,
    empty: {},
  },
)

export function useProblemMastery(user: User | null) {
  const { data: masteryMap } = mathProblemMasteryStore.useSessionData(user)

  const recordProblemResult = useCallback(
    (key: string, correct: boolean) => {
      if (!user) return
      const today = new Date().toISOString().slice(0, 10)
      const cur: WordMasteryInfo = masteryMap[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
      const sameDay = cur.lastSeen === today

      let stageUpdated: WordMasteryInfo
      if (correct && !sameDay) {
        stageUpdated = advanceStage(cur, today, key)
      } else if (!correct && !sameDay) {
        stageUpdated = regressStage(cur, today)
      } else {
        stageUpdated = cur
      }

      const info: WordMasteryInfo = {
        ...stageUpdated,
        correct: correct ? cur.correct + 1 : cur.correct,
        incorrect: correct ? cur.incorrect : cur.incorrect + 1,
        lastSeen: today,
      }

      mathProblemMasteryStore.patchSessionData(user.id, (prev) => ({ ...prev, [key]: info }))

      void supabase
        .from('problem_mastery')
        .upsert(
          {
            user_id: user.id,
            problem_key: key,
            correct: info.correct,
            incorrect: info.incorrect,
            last_seen: today,
            stage: info.stage,
            next_review_date: info.nextReviewDate ?? null,
            is_hard: info.isHard ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,problem_key' },
        )
        .then(({ error }) => {
          if (error) console.error('[problem_mastery] upsert error:', error)
        })
    },
    [user, masteryMap],
  )

  return { masteryMap, recordProblemResult }
}
