'use client'

import { useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  advanceStage,
  createUserSessionStore,
  getWordMasteryLevel,
  regressStage,
  supabase,
} from '@rosie/core'
import { wordKey } from '../utils/english-helpers'
import type { WordEntry, WordMasteryMap, WordMasteryInfo, ReviewRecord, VocabularyEvidence, WordPracticeResult } from '@rosie/core'

async function fetchWordMastery(userId: string): Promise<WordMasteryMap> {
  const record: WordMasteryMap = {}
  for (const table of ['word_mastery', 'vocabulary_mastery_overlay'] as const) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
        .order('word_key').range(offset, offset + 999)
      if (error) throw error
      for (const row of data ?? []) {
        const previous = record[row.word_key]
        record[row.word_key] = {
          correct: row.correct ?? previous?.correct ?? 0,
          incorrect: row.incorrect ?? 0,
          lastSeen: row.last_seen ?? '',
          stage: row.stage ?? undefined,
          nextReviewDate: row.next_review_date ?? undefined,
          isHard: row.is_hard ?? undefined,
          reviewHistory: (row.review_history as ReviewRecord[] | null) ?? previous?.reviewHistory ?? [],
        }
      }
      if (!data || data.length < 1000) break
    }
  }
  return record
}

export const wordMasteryStore = createUserSessionStore<WordMasteryMap>('word_mastery', {
  fetch: fetchWordMastery,
  empty: {},
})

const pendingEvidence = new Map<string, Map<string, VocabularyEvidence>>()
const evidenceWrites = new Map<string, Promise<void>>()

function submitVocabularyEvidence(userId: string, attempts: VocabularyEvidence[]) {
  const queue = pendingEvidence.get(userId) ?? new Map<string, VocabularyEvidence>()
  for (const attempt of attempts) queue.set(attempt.id, attempt)
  if (!queue.size) return
  pendingEvidence.set(userId, queue)
  if (evidenceWrites.has(userId)) return

  const operation = (async () => {
    while (queue.size) {
      const batch = Array.from(queue.values()).slice(0, 500)
      const { error } = await supabase.rpc('record_vocabulary_practice', { p_user_id: userId, p_attempts: batch })
      if (error) throw error
      for (const attempt of batch) queue.delete(attempt.id)
    }
    pendingEvidence.delete(userId)
  })()
  evidenceWrites.set(userId, operation)
  void operation
    .finally(() => evidenceWrites.delete(userId))
    .then(() => wordMasteryStore.refreshInBackground(userId))
    .catch((error: unknown) => console.error('[vocabulary_skill_progress] save failed', error))
}

export function useWordMastery(user: User | null) {
  const { data: masteryMap, isLoading } = wordMasteryStore.useSessionData(user)
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    const retryPending = () => submitVocabularyEvidence(userId, [])
    retryPending()
    window.addEventListener('online', retryPending)
    return () => window.removeEventListener('online', retryPending)
  }, [userId])

  const recordBatch = useCallback(
    (results: WordPracticeResult[]) => {
      if (!user) return
      if (results.length === 0) return
      submitVocabularyEvidence(user.id, results.flatMap((result) => result.evidence ? [result.evidence] : []))
      const today = new Date().toISOString().slice(0, 10)

      type Group = { entry: WordEntry; corrects: number; total: number }
      const byKey = new Map<string, Group>()
      for (const { entry, correct, evidence } of results) {
        if (evidence) continue
        const k = wordKey(entry)
        const g = byKey.get(k) ?? { entry, corrects: 0, total: 0 }
        if (correct) g.corrects += 1
        g.total += 1
        byKey.set(k, g)
      }

      if (byKey.size === 0) return
      const touchedKeys: string[] = []
      wordMasteryStore.patchSessionData(user.id, (prev) => {
        const next = { ...prev }
        for (const [key, g] of byKey) {
          const cur: WordMasteryInfo = next[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
          const allCorrect = g.corrects === g.total
          const majorityCorrect = g.corrects > g.total / 2
          const sameDay = cur.lastSeen === today

          let stageUpdated: WordMasteryInfo
          if (allCorrect && !sameDay) {
            stageUpdated = advanceStage(cur, today, key)
          } else if (!majorityCorrect && !sameDay) {
            stageUpdated = regressStage(cur, today)
          } else {
            stageUpdated = cur
          }

          const historyAppends = results
            .filter((r) => wordKey(r.entry) === key)
            .map((r) => ({ date: today, correct: r.correct }))

          next[key] = {
            ...stageUpdated,
            correct: cur.correct + g.corrects,
            incorrect: cur.incorrect + (g.total - g.corrects),
            lastSeen: today,
            reviewHistory: [...(cur.reviewHistory ?? []), ...historyAppends],
          }
          touchedKeys.push(key)
        }
        return next
      })

      const snapshot = wordMasteryStore.getSessionData(user.id) ?? {}
      const rows = touchedKeys.map((key) => {
        const updated = snapshot[key]
        return {
          user_id: user.id,
          word_key: key,
          correct: updated.correct,
          incorrect: updated.incorrect,
          last_seen: today,
          stage: updated.stage,
          next_review_date: updated.nextReviewDate ?? null,
          is_hard: updated.isHard ?? false,
          review_history: updated.reviewHistory ?? [],
          updated_at: new Date().toISOString(),
        }
      })
      void supabase
        .from('word_mastery')
        .upsert(rows, { onConflict: 'user_id,word_key' })
        .then(({ error }) => {
          if (error) console.error('[word_mastery] upsert failed', error)
        })
    },
    [user],
  )

  const recordRecallAttempt = useCallback(
    (entry: WordEntry, correct: boolean) => {
      if (!user) return
      if (entry.id && entry.practiceSenseId) {
        submitVocabularyEvidence(user.id, [{
          id: crypto.randomUUID(),
          wordEntryId: entry.id,
          targetId: entry.practiceSenseId,
          skill: 'meaning',
          correct,
          independent: true,
        }])
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const key = wordKey(entry)

      wordMasteryStore.patchSessionData(user.id, (prev) => {
        const cur: WordMasteryInfo = prev[key] ?? { correct: 0, incorrect: 0, lastSeen: '' }
        const sameDay = cur.lastSeen === today
        const stageUpdated = correct && !sameDay ? advanceStage(cur, today, key) : cur

        const updated: WordMasteryInfo = {
          ...stageUpdated,
          correct: cur.correct + (correct ? 1 : 0),
          incorrect: cur.incorrect + (correct ? 0 : 1),
          lastSeen: today,
          reviewHistory: [...(cur.reviewHistory ?? []), { date: today, correct, source: 'recall' }],
        }

        return { ...prev, [key]: updated }
      })

      const updated = wordMasteryStore.getSessionData(user.id)?.[key]
      if (!updated) return

      void supabase
        .from('word_mastery')
        .upsert(
          [
            {
              user_id: user.id,
              word_key: key,
              correct: updated.correct,
              incorrect: updated.incorrect,
              last_seen: today,
              stage: updated.stage ?? null,
              next_review_date: updated.nextReviewDate ?? null,
              is_hard: updated.isHard ?? false,
              review_history: updated.reviewHistory ?? [],
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'user_id,word_key' },
        )
        .then(({ error }) => {
          if (error) console.error('[word_mastery] recall upsert failed', error)
        })
    },
    [user],
  )

  const getMastery = useCallback(
    (entry: WordEntry): WordMasteryInfo => {
      return masteryMap[wordKey(entry)] ?? { correct: 0, incorrect: 0, lastSeen: '' }
    },
    [masteryMap],
  )

  const isMastered = useCallback(
    (entry: WordEntry): boolean => {
      return getWordMasteryLevel(getMastery(entry).correct) === 3
    },
    [getMastery],
  )

  return { masteryMap, recordBatch, recordRecallAttempt, getMastery, isMastered, isLoading }
}
