import type { ChineseLessonRow, LessonCharGroup } from '../types/chineseCharData'
import type { ChineseBookSlug } from './chinese-books'
import { parseBookSlug } from './chinese-helpers'
import { getLessonDisplayInfo, sortLessonsPedagogically } from './chinese-lesson-display'
import { chineseRoute } from './chinese-routes'
import type { RoadmapNode, RoadmapNodeState } from './chinese-roadmap'
import type {
  ChinesePlanQuizType,
  ChineseRoadmapPlan,
} from './chineseRoadmapPlanTypes'

export function resolveChinesePlanCreateStatus(hasActive: boolean): 'active' | 'paused' {
  return hasActive ? 'paused' : 'active'
}

/** Practice session URL driven by an active roadmap plan (lessons + types + planId). */
export function buildChinesePlanPracticeHref(
  plan: Pick<ChineseRoadmapPlan, 'id' | 'quizTypes' | 'bookSlug'>,
  batchKeys: string[],
): string {
  const q = new URLSearchParams({
    lessons: batchKeys.join(','),
    types: plan.quizTypes.join(','),
    planId: plan.id,
  })
  return `${chineseRoute(plan.bookSlug, 'chars/practice')}?${q.toString()}`
}

/** Pedagogical lesson-key order for a plan's book (excludes happy_reading). */
export function orderedPlanLessonKeys(
  lessons: ChineseLessonRow[],
  bookSlug: ChineseBookSlug,
): string[] {
  const parsed = parseBookSlug(bookSlug)
  const bookLessons = parsed
    ? lessons.filter((l) => l.grade === parsed.grade && l.semester === parsed.semester)
    : lessons
  return sortLessonsPedagogically(bookLessons)
    .filter((l) => l.lessonKind !== 'happy_reading')
    .map((l) => l.lessonKey)
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

/** Thin poem↔lesson match (mirrors chinese-chars-session-helpers). */
export function poemMatchesLessonMeta(
  poem: { unit: number; source?: string; lesson?: number },
  lessonKind: string,
  lessonMeta: { unit: number; lesson: number },
): boolean {
  if (poem.unit !== lessonMeta.unit) return false
  if (poem.source === 'garden') return lessonKind === 'garden'
  return lessonMeta.lesson === poem.lesson
}

type PracticePlanForPhases = {
  charQuestions: {
    lessonKey: string
    quizType?: string
    track?: string
    kind?: string
  }[]
  phraseItems: { lessonKey: string }[]
  poems: { unit: number; source?: string; lesson?: number }[]
  accumulationItems: { unit: number }[]
  blankItems: { lessonKey: string }[]
  readingLessons: { lessonKey: string }[]
  pinyinWriteItems: { lessonKey: string }[]
}

function phaseNameFromCharQuestion(q: {
  quizType?: string
  track?: string
  kind?: string
}): string | null {
  const raw = q.quizType ?? q.kind ?? q.track
  if (!raw) return null
  if (raw === 'phrase-char' || raw === 'phrase') return 'phrase'
  if (raw === 'write' || raw === 'stroke') return 'stroke'
  if (raw === 'recognize') return 'recognize'
  return raw
}

/** Map PracticeSessionPlan content for one lessonKey → present phase names */
export function presentPhasesForLesson(
  lessonKey: string,
  lessonKind: string,
  plan: PracticePlanForPhases,
  lessonMeta: { unit: number; lesson: number },
): string[] {
  const phases = new Set<string>()

  for (const q of plan.charQuestions) {
    if (q.lessonKey !== lessonKey) continue
    const phase = phaseNameFromCharQuestion(q)
    if (phase) phases.add(phase)
  }

  if (plan.phraseItems.some((item) => item.lessonKey === lessonKey)) {
    phases.add('phrase')
  }

  if (plan.poems.some((poem) => poemMatchesLessonMeta(poem, lessonKind, lessonMeta))) {
    phases.add('poems')
  }

  if (
    lessonKind === 'garden' &&
    plan.accumulationItems.some((item) => item.unit === lessonMeta.unit)
  ) {
    phases.add('accumulation')
  }

  if (plan.blankItems.some((item) => item.lessonKey === lessonKey)) {
    phases.add('blank')
  }

  if (plan.readingLessons.some((item) => item.lessonKey === lessonKey)) {
    phases.add('passage')
  }

  if (plan.pinyinWriteItems.some((item) => item.lessonKey === lessonKey)) {
    phases.add('pinyin-write')
  }

  return [...phases]
}

/**
 * Present + finished phases for one lesson after a practice session.
 * When `sessionReachedDone`, every present phase is treated as finished.
 */
export function summarizeLessonPhases(args: {
  lessonKey: string
  lessonKind: string
  plan: PracticePlanForPhases
  lessonMeta: { unit: number; lesson: number }
  sessionReachedDone?: boolean
  finishedPhases?: string[]
}): { presentPhases: string[]; finishedPhases: string[] } {
  const presentPhases = presentPhasesForLesson(
    args.lessonKey,
    args.lessonKind,
    args.plan,
    args.lessonMeta,
  )
  const finishedPhases = args.finishedPhases
    ? [...args.finishedPhases]
    : args.sessionReachedDone
      ? [...presentPhases]
      : []
  return { presentPhases, finishedPhases }
}

/** Next pointer + book-finished after merging newly completed batch keys. */
export function computeAdvanceAfterBatch(args: {
  orderedKeys: string[]
  completedLessonKeys: string[]
  newlyCompletedKeys: string[]
}): {
  mergedCompleted: string[]
  nextCurrentLessonKey: string
  bookFinished: boolean
} {
  const seen = new Set(args.completedLessonKeys)
  const mergedCompleted = [...args.completedLessonKeys]
  for (const key of args.newlyCompletedKeys) {
    if (seen.has(key)) continue
    seen.add(key)
    mergedCompleted.push(key)
  }

  const nextCurrentLessonKey =
    args.orderedKeys.find((key) => !seen.has(key)) ??
    args.orderedKeys[args.orderedKeys.length - 1] ??
    ''

  const bookFinished =
    args.orderedKeys.length > 0 && args.orderedKeys.every((key) => seen.has(key))

  return { mergedCompleted, nextCurrentLessonKey, bookFinished }
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
