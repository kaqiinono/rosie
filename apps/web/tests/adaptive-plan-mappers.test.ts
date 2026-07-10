import { describe, expect, it } from 'vitest'
import {
  mapPlanModelToRow,
  mapPlanRowToModel,
  mapProgressModelToRow,
  mapProgressRowToModel,
} from '../../../packages/english/src/utils/adaptivePlanMappers'

describe('adaptive plan mappers', () => {
  it('round-trips an adaptive word plan row', () => {
    const row = {
      id: 'plan-1',
      user_id: 'user-1',
      title: 'Summer Words',
      scope: { stages: ['4B'], lessonKeys: ['U1::L1'] },
      new_words_per_day: 8,
      review_cap: 30,
      review_batch_size: 12,
      backlog_fuse: 40,
      boss_every_n_new: 25,
      boss_stubborn_threshold: 6,
      mode: 'boss',
      status: 'active',
      stats: {
        bossFailStreak: 2,
        bossQuestionTier: 3,
        everActivatedCount: 70,
        totalActivatedCount: 80,
        lastBossActivatedCount: 50,
      },
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
      archived_at: null,
    }

    const model = mapPlanRowToModel(row)

    expect(model).toEqual({
      id: 'plan-1',
      userId: 'user-1',
      title: 'Summer Words',
      scope: { stages: ['4B'], lessonKeys: ['U1::L1'] },
      newWordsPerDay: 8,
      reviewCap: 30,
      reviewBatchSize: 12,
      backlogFuse: 40,
      bossEveryNNew: 25,
      bossStubbornThreshold: 6,
      mode: 'boss',
      status: 'active',
      stats: {
        bossFailStreak: 2,
        bossQuestionTier: 3,
        everActivatedCount: 70,
        totalActivatedCount: 80,
        lastBossActivatedCount: 50,
      },
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    })
    expect(mapPlanModelToRow(model)).toEqual(row)
  })

  it('round-trips an adaptive progress row', () => {
    const row = {
      id: 'progress-1',
      plan_id: 'plan-1',
      user_id: 'user-1',
      word_key: 'U1::L1::apple',
      status: 'LEARNING',
      box_index: 2,
      target_box: 3,
      streak_wrong: 1,
      next_review_date: '2026-07-10',
      introduced_on: '2026-07-09',
      archived_at: null,
    }

    const model = mapProgressRowToModel(row)

    expect(model).toEqual({
      id: 'progress-1',
      planId: 'plan-1',
      userId: 'user-1',
      wordKey: 'U1::L1::apple',
      status: 'LEARNING',
      boxIndex: 2,
      targetBox: 3,
      streakWrong: 1,
      nextReviewDate: '2026-07-10',
      introducedOn: '2026-07-09',
      archivedAt: null,
    })
    expect(mapProgressModelToRow(model)).toEqual(row)
  })
})
