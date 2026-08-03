import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { ChineseBookSlug } from './chinese-books'
import { parseBookSlug } from './chinese-helpers'
import { getLessonDisplayInfo, sortLessonsPedagogically } from './chinese-lesson-display'
import type { RoadmapNode, RoadmapNodeState } from './chinese-roadmap'
import type {
  ChinesePlanQuizType,
  ChineseRoadmapPlan,
} from './chineseRoadmapPlanTypes'

export function resolveChinesePlanCreateStatus(hasActive: boolean): 'active' | 'paused' {
  return hasActive ? 'paused' : 'active'
}

/**
 * Batch of K lessons starting at `currentLessonKey`.
 * Always includes current (even if already completed), then following incomplete keys.
 */
export function currentBatchLessonKeys(
  orderedKeys: string[],
  currentLessonKey: string,
  k: number,
  completed: Set<string>,
): string[] {
  if (k <= 0) return []
  const start = orderedKeys.indexOf(currentLessonKey)
  if (start < 0) return []

  const out: string[] = []
  for (let i = start; i < orderedKeys.length && out.length < k; i++) {
    const key = orderedKeys[i]
    if (i === start || !completed.has(key)) {
      out.push(key)
    }
  }
  return out
}

export function isLessonCompleteForPlan(args: {
  lessonKind: string
  planQuizTypes: ChinesePlanQuizType[]
  /** Phases that actually have content for this lesson */
  presentPhases: string[]
  /** Phases finished in this session (or prior completed run) */
  finishedPhases: string[]
}): boolean {
  const present = new Set(args.presentPhases)
  const finished = new Set(args.finishedPhases)
  const required = new Set<string>()
  for (const t of args.planQuizTypes) {
    if (present.has(t)) required.add(t)
  }
  // Always require auto content phases when present (garden + any lesson with poems)
  for (const extra of ['poems', 'accumulation'] as const) {
    if (present.has(extra)) required.add(extra)
  }
  if (required.size === 0) return false // never complete on empty
  for (const r of required) {
    if (!finished.has(r)) return false
  }
  return true
}

/**
 * Plan-local roadmap nodes: completed / current / locked from plan progress
 * (not global char mastery).
 */
export function buildPlanRoadmapNodes(
  lessons: ChineseLessonRow[],
  lessonGroups: LessonCharGroup[],
  plan: Pick<ChineseRoadmapPlan, 'completedLessonKeys' | 'currentLessonKey'>,
  bookSlug: ChineseBookSlug,
): RoadmapNode[] {
  const parsed = parseBookSlug(bookSlug)
  const bookLessons = parsed
    ? lessons.filter((l) => l.grade === parsed.grade && l.semester === parsed.semester)
    : lessons

  const ordered = sortLessonsPedagogically(bookLessons).filter(
    (l) => l.lessonKind !== 'happy_reading',
  )
  const groupByKey = new Map(lessonGroups.map((g) => [g.lessonKey, g]))
  const completed = new Set(plan.completedLessonKeys)

  return ordered.map((lesson) => {
    const unitLessons = bookLessons.filter((l) => l.unit === lesson.unit)
    const display = getLessonDisplayInfo(lesson, unitLessons)
    const group = groupByKey.get(lesson.lessonKey)
    const isComplete = completed.has(lesson.lessonKey)
    const total = group ? group.recognize.length + group.write.length : 0

    let state: RoadmapNodeState
    if (isComplete) {
      state = 'completed'
    } else if (lesson.lessonKey === plan.currentLessonKey) {
      state = 'current'
    } else {
      state = 'locked'
    }

    return {
      lessonKey: lesson.lessonKey,
      unit: lesson.unit,
      lessonTitle: lesson.lessonTitle,
      lessonKind: lesson.lessonKind,
      label: display.label,
      unitLessonNo: display.unitLessonNo,
      bookLessonNo: display.bookLessonNo,
      group,
      status: {
        total,
        correct: isComplete ? total : 0,
        isComplete,
      },
      state,
    }
  })
}
