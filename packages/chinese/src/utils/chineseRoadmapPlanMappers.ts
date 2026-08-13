import type { ChineseBookSlug } from './chinese-books'
import { isChineseBookSlug } from './chinese-books'
import {
  CHINESE_PLAN_QUIZ_TYPES,
  type ChinesePlanQuizType,
  type ChinesePlanRunSource,
  type ChineseRoadmapPlan,
  type ChineseRoadmapPlanLessonRun,
  type ChineseRoadmapPlanLessonRunRow,
  type ChineseRoadmapPlanRow,
  type ChineseRoadmapPlanStatus,
} from './chineseRoadmapPlanTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrDefault(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function parsePlanStatus(value: string): ChineseRoadmapPlanStatus {
  if (value === 'paused' || value === 'completed' || value === 'archived') return value
  return 'active'
}

function parseBookSlug(value: string): ChineseBookSlug {
  return isChineseBookSlug(value) ? value : 'g1b'
}

function parseQuizTypes(value: string[] | null | undefined): ChinesePlanQuizType[] {
  // Default only when column is null/absent — preserve explicit [] (and invalid-only → []).
  if (value == null || !Array.isArray(value)) return [...CHINESE_PLAN_QUIZ_TYPES]
  const allowed = new Set<string>(CHINESE_PLAN_QUIZ_TYPES)
  return value.filter((t): t is ChinesePlanQuizType => allowed.has(t))
}

function parseStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseAccuracy(value: number | string | null): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function parseByType(value: unknown): Record<string, { total: number; correct: number }> {
  if (!isRecord(value)) return {}
  const out: Record<string, { total: number; correct: number }> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue
    out[key] = {
      total: numberOrDefault(entry.total, 0),
      correct: numberOrDefault(entry.correct, 0),
    }
  }
  return out
}

/** DB Row (snake_case) -> app model (camelCase). */
export function mapPlanRowToModel(row: ChineseRoadmapPlanRow): ChineseRoadmapPlan {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    bookSlug: parseBookSlug(row.book_slug),
    startLessonKey: row.start_lesson_key,
    currentLessonKey: row.current_lesson_key,
    lessonsPerBatch: numberOrDefault(row.lessons_per_batch, 1),
    quizTypes: parseQuizTypes(row.quiz_types),
    status: parsePlanStatus(row.status),
    completedLessonKeys: parseStringArray(row.completed_lesson_keys),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  }
}

/** App model -> Insert/Update payload (snake_case) for upsert. */
export function mapPlanModelToRow(plan: ChineseRoadmapPlan): Record<string, unknown> {
  return {
    id: plan.id,
    user_id: plan.userId,
    title: plan.title,
    book_slug: plan.bookSlug,
    start_lesson_key: plan.startLessonKey,
    current_lesson_key: plan.currentLessonKey,
    lessons_per_batch: plan.lessonsPerBatch,
    quiz_types: plan.quizTypes,
    status: plan.status,
    completed_lesson_keys: plan.completedLessonKeys,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
    archived_at: plan.archivedAt,
  }
}

function parseRunSource(value: string | null): ChinesePlanRunSource {
  if (value === 'free' || value === 'review') return value
  return 'plan'
}

/** DB Row (snake_case) -> app model (camelCase). */
export function mapRunRowToModel(row: ChineseRoadmapPlanLessonRunRow): ChineseRoadmapPlanLessonRun {
  return {
    id: row.id,
    planId: row.plan_id,
    userId: row.user_id,
    lessonKey: row.lesson_key,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    completed: Boolean(row.completed),
    total: numberOrDefault(row.total, 0),
    correct: numberOrDefault(row.correct, 0),
    accuracy: parseAccuracy(row.accuracy),
    byType: parseByType(row.by_type),
    quizTypes: parseStringArray(row.quiz_types),
    durationSeconds: row.duration_seconds ?? null,
    source: parseRunSource(row.source),
    finishedPhases: parseStringArray(row.finished_phases),
    lessonTitle: row.lesson_title ?? '',
  }
}

/** App model -> Insert/Update payload (snake_case) for upsert. */
export function mapRunModelToRow(run: ChineseRoadmapPlanLessonRun): Record<string, unknown> {
  return {
    id: run.id,
    plan_id: run.planId,
    user_id: run.userId,
    lesson_key: run.lessonKey,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    completed: run.completed,
    total: run.total,
    correct: run.correct,
    accuracy: run.accuracy,
    by_type: run.byType,
    quiz_types: run.quizTypes,
    duration_seconds: run.durationSeconds,
    source: run.source,
    finished_phases: run.finishedPhases,
    lesson_title: run.lessonTitle,
  }
}
