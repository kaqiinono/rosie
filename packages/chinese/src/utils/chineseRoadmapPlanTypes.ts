import type { ChineseBookSlug } from './chinese-books'

export type ChineseRoadmapPlanStatus = 'active' | 'paused' | 'completed' | 'archived'

export type ChinesePlanQuizType =
  | 'recognize'
  | 'stroke'
  | 'phrase'
  | 'blank'
  | 'passage'
  | 'pinyin-write'

export const CHINESE_PLAN_QUIZ_TYPES: ChinesePlanQuizType[] = [
  'recognize',
  'stroke',
  'phrase',
  'blank',
  'passage',
  'pinyin-write',
]

export type PlanSessionPhase =
  | ChinesePlanQuizType
  | 'poems'
  | 'accumulation'
  | 'phrase'

export interface ChineseRoadmapPlan {
  id: string
  userId: string
  title: string
  bookSlug: ChineseBookSlug
  startLessonKey: string
  currentLessonKey: string
  lessonsPerBatch: number
  quizTypes: ChinesePlanQuizType[]
  status: ChineseRoadmapPlanStatus
  completedLessonKeys: string[]
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface ChineseRoadmapPlanLessonRun {
  id: string
  planId: string
  userId: string
  lessonKey: string
  startedAt: string
  finishedAt: string
  completed: boolean
  total: number
  correct: number
  accuracy: number | null
  byType: Record<string, { total: number; correct: number }>
  quizTypes: string[]
}

export type ChineseRoadmapPlanRow = {
  id: string
  user_id: string
  title: string
  book_slug: string
  start_lesson_key: string
  current_lesson_key: string
  lessons_per_batch: number
  quiz_types: string[] | null
  status: string
  completed_lesson_keys: string[] | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ChineseRoadmapPlanLessonRunRow = {
  id: string
  plan_id: string
  user_id: string
  lesson_key: string
  started_at: string
  finished_at: string
  completed: boolean
  total: number
  correct: number
  accuracy: number | string | null
  by_type: unknown
  quiz_types: string[] | null
}
