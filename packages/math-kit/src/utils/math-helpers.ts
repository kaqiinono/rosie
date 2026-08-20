import type {
  ProblemSet,
  Problem,
  MathPlanProblem,
  MathWeeklyPlan,
  MathWeeklyPlanDay,
  MathDayProgress,
  ProblemMasteryMap,
  MathRotatingReviewState,
  PerLessonRotationState,
  MathWeeklyLessonReviewState,
} from '@rosie/core'
import { ensureStageInit, isGraduated, todayStr } from '@rosie/core'

export function problemKey(lessonId: string, problemId: string): string {
  return `${lessonId}::${problemId}`
}

export function planAssignmentId(problem: MathPlanProblem, date: string): string {
  return problem.assignmentId ?? `${date}::${problem.key}`
}

export function isPlanProblemDone(
  problem: MathPlanProblem,
  date: string,
  doneKeys: ReadonlySet<string> | string[],
): boolean {
  const done = doneKeys instanceof Set ? doneKeys : new Set(doneKeys)
  // Assignment-aware plans must never fall back to the old problem-only key:
  // the same problem can be scheduled on several dates. Legacy plans without
  // assignmentId keep the old lookup until they are normalized on load.
  return (
    done.has(planAssignmentId(problem, date)) ||
    (problem.assignmentId == null && done.has(problem.key))
  )
}

export function ensureMathPlanAssignmentIds(days: MathWeeklyPlanDay[]): MathWeeklyPlanDay[] {
  return days.map((day) => ({
    ...day,
    problems: day.problems.map((problem) => ({
      ...problem,
      assignmentId: planAssignmentId(problem, day.date),
    })),
    optionalProblems: (day.optionalProblems ?? []).map((problem) => ({
      ...problem,
      assignmentId: planAssignmentId(problem, day.date),
    })),
  }))
}

/**
 * Upgrade date-scoped legacy problem keys to assignment ids. Old keys on a
 * future date are not trustworthy (they were vulnerable to cross-day matches),
 * while exact assignment ids remain valid for intentional ahead-of-plan work.
 */
export function normalizeMathPlanProgress(
  days: MathWeeklyPlanDay[],
  progress: MathWeeklyPlan['progress'],
  today = todayStr(),
): MathWeeklyPlan['progress'] {
  return Object.fromEntries(Object.entries(progress).map(([date, dayProgress]) => {
    const problems = days.find((day) => day.date === date)?.problems ?? []
    const legacyAssignments = new Map(
      problems.map((problem) => [problem.key, planAssignmentId(problem, date)]),
    )
    const doneKeys = dayProgress.doneKeys.flatMap((key) => {
      const assignmentId = legacyAssignments.get(key)
      if (!assignmentId) return [key]
      return date <= today ? [assignmentId] : []
    })
    return [date, { ...dayProgress, doneKeys: [...new Set(doneKeys)] }]
  }))
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function makeProblem(
  lessonId: string,
  section: string,
  problem: Problem,
  index: number,
): MathPlanProblem {
  return {
    key: problemKey(lessonId, problem.id),
    lessonId,
    section,
    index,
    title: problem.title,
    problemId: problem.id,
    tagLabel: problem.tagLabel,
  }
}

export type MathPlanSectionKey = 'lesson' | 'homework' | 'pretest' | 'workbook' | 'supplement'

export const MATH_PLAN_SECTIONS: { key: MathPlanSectionKey; label: string }[] = [
  { key: 'lesson', label: '课堂讲解' },
  { key: 'homework', label: '课后巩固' },
  { key: 'pretest', label: '课前测' },
  { key: 'workbook', label: '练习册' },
  { key: 'supplement', label: '附加题' },
]

const ALL_PLAN_SECTIONS: MathPlanSectionKey[] = ['lesson', 'homework', 'pretest', 'workbook', 'supplement']

/** Map problemId → MathPlanProblem for wrong-answer / lookup UIs. */
export function buildProblemIdMap(
  problemSets: Record<string, ProblemSet>,
  lessonIds?: string[],
): Map<string, MathPlanProblem> {
  const map = new Map<string, MathPlanProblem>()
  const ids = lessonIds ?? Object.keys(problemSets)
  for (const lessonId of ids) {
    const ps = problemSets[lessonId]
    if (!ps) continue
    for (const section of ALL_PLAN_SECTIONS) {
      const problems = getSectionProblems(ps, section)
      problems.forEach((p, i) => map.set(p.id, makeProblem(lessonId, section, p, i + 1)))
    }
  }
  return map
}

const DEFAULT_SECTIONS: MathPlanSectionKey[] = ['lesson', 'homework', 'pretest']

function parseTypeOrder(tag: string): number {
  const m = tag.match(/type(\d+)/i)
  return m ? Number(m[1]) : 999
}

function getSectionProblems(ps: ProblemSet, section: string): Problem[] {
  if (section === 'supplement') return ps.supplement ?? []
  if (section === 'lesson') return ps.lesson
  if (section === 'homework') return ps.homework
  if (section === 'pretest') return ps.pretest
  if (section === 'workbook') return ps.workbook
  return []
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const [y, m, d] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const cur = new Date(y, m - 1, d)
  const end = new Date(ey, em - 1, ed)
  const dates: string[] = []
  while (cur <= end) {
    dates.push(toLocalDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

type PoolItem = {
  prob: MathPlanProblem
  tag: string
  difficulty: number
  typeOrder: number
  practiced: boolean
}

function sortPoolItemsByPracticeAndDifficulty(items: PoolItem[]): void {
  items.sort((a, b) => {
    if (a.practiced !== b.practiced) return a.practiced ? 1 : -1
    return a.difficulty - b.difficulty || a.prob.key.localeCompare(b.prob.key)
  })
}

function unpracticedRemainingInTag(items: PoolItem[], ptr: number): number {
  return items.slice(ptr).filter(item => !item.practiced).length
}

export type LessonTagStat = {
  tag: string
  tagLabel: string
  total: number
  practiced: number
  typeOrder: number
}

export type LessonSectionStat = {
  section: MathPlanSectionKey
  total: number
  practiced: number
}

export function getLessonSectionStats(
  ps: ProblemSet,
  sections: MathPlanSectionKey[],
  practiceCount: Record<string, number>,
): LessonSectionStat[] {
  return sections.map(section => {
    const probs = getSectionProblems(ps, section)
    return {
      section,
      total: probs.length,
      practiced: probs.filter(p => (practiceCount[p.id] ?? 0) > 0).length,
    }
  })
}

export function getLessonTagStats(
  ps: ProblemSet,
  sections: MathPlanSectionKey[],
  practiceCount: Record<string, number>,
): LessonTagStat[] {
  const byTag = new Map<string, LessonTagStat>()
  for (const section of sections) {
    for (const p of getSectionProblems(ps, section)) {
      const existing = byTag.get(p.tag) ?? {
        tag: p.tag,
        tagLabel: p.tagLabel,
        total: 0,
        practiced: 0,
        typeOrder: parseTypeOrder(p.tag),
      }
      existing.total += 1
      if ((practiceCount[p.id] ?? 0) > 0) existing.practiced += 1
      byTag.set(p.tag, existing)
    }
  }
  return [...byTag.values()].sort((a, b) => a.typeOrder - b.typeOrder || a.tag.localeCompare(b.tag))
}

function problemMatchesTagFilter(tag: string, tagFilters: Record<string, string[]>, lessonId: string): boolean {
  const enabled = tagFilters[lessonId]
  if (!enabled || enabled.length === 0) return true
  return enabled.includes(tag)
}

export function countFilteredPlanProblems(
  lessonIds: string[],
  sectionFilters: Record<string, string[]>,
  problemSets: Record<string, ProblemSet>,
  tagFilters: Record<string, string[]> = {},
): number {
  let total = 0
  for (const lessonId of lessonIds) {
    const ps = problemSets[lessonId]
    if (!ps) continue
    const sections = (sectionFilters[lessonId] ?? DEFAULT_SECTIONS) as MathPlanSectionKey[]
    for (const section of sections) {
      for (const p of getSectionProblems(ps, section)) {
        if (problemMatchesTagFilter(p.tag, tagFilters, lessonId)) total += 1
      }
    }
  }
  return total
}

export type BuildMathFlexiblePlanOptions = {
  /** Prior plan days (edit flow). Days that stay frozen keep their historical problem lists. */
  existingDays?: MathWeeklyPlanDay[]
  /**
   * ISO date (typically today). Existing days with `date <= freezeDate` are frozen.
   * Fully completed existing days after this date are also frozen.
   */
  freezeDate?: string
  /** Used to detect fully completed days for freezing after freezeDate. */
  progress?: Record<string, MathDayProgress>
}

function isExistingDayFullyComplete(
  day: MathWeeklyPlanDay,
  progress: Record<string, MathDayProgress> | undefined,
): boolean {
  if (day.problems.length === 0) return false
  const done = new Set((progress?.[day.date] ?? { doneKeys: [] }).doneKeys)
  return day.problems.every((p) => isPlanProblemDone(p, day.date, done))
}

function collectPoolItems(
  lessonIds: string[],
  sectionFilters: Record<string, string[]>,
  problemSets: Record<string, ProblemSet>,
  tagFilters: Record<string, string[]>,
  practiceCount: Record<string, number>,
): PoolItem[] {
  const pool: PoolItem[] = []
  for (const lessonId of lessonIds) {
    const ps = problemSets[lessonId]
    if (!ps) continue
    const sections = (sectionFilters[lessonId] ?? DEFAULT_SECTIONS) as MathPlanSectionKey[]
    for (const section of sections) {
      getSectionProblems(ps, section).forEach((p, i) => {
        if (!problemMatchesTagFilter(p.tag, tagFilters, lessonId)) return
        pool.push({
          prob: makeProblem(lessonId, section, p, i + 1),
          tag: `${lessonId}::${p.tag}`,
          difficulty: p.difficulty,
          typeOrder: parseTypeOrder(p.tag),
          practiced: (practiceCount[p.id] ?? 0) > 0,
        })
      })
    }
  }
  return pool
}

/** Allocate pool across target dates with type-aware balancing. Mutates nothing outside return value. */
function allocatePoolAcrossDates(
  pool: PoolItem[],
  dates: string[],
): { days: MathWeeklyPlanDay[]; problemsPerDay: number } {
  const emptyDays = dates.map((date) => ({ date, problems: [] as MathPlanProblem[], optionalProblems: [] as MathPlanProblem[] }))
  if (pool.length === 0 || dates.length === 0) {
    return { days: emptyDays, problemsPerDay: 0 }
  }

  const problemsPerDay = Math.max(1, Math.ceil(pool.length / dates.length))

  const byTag = new Map<string, PoolItem[]>()
  for (const item of pool) {
    const list = byTag.get(item.tag) ?? []
    list.push(item)
    byTag.set(item.tag, list)
  }
  for (const items of byTag.values()) {
    sortPoolItemsByPracticeAndDifficulty(items)
  }

  const tagMeta = [...byTag.entries()].map(([tag, items]) => ({
    tag,
    lessonId: items[0]!.prob.lessonId,
    typeOrder: items[0]!.typeOrder,
    minDiff: Math.min(...items.map((i) => i.difficulty)),
  }))
  tagMeta.sort((a, b) => a.typeOrder - b.typeOrder || a.minDiff - b.minDiff)

  const typeAllocationCount = Object.fromEntries(tagMeta.map(({ tag }) => [tag, 0]))
  const tagPointers = Object.fromEntries(tagMeta.map(({ tag }) => [tag, 0]))

  const days = emptyDays
  let remaining = pool.length
  for (let dayIdx = 0; dayIdx < dates.length && remaining > 0; dayIdx++) {
    const quota = Math.min(problemsPerDay, remaining)
    const dayProbs: MathPlanProblem[] = []
    const lessonCountOnDay = new Map<string, number>()

    while (dayProbs.length < quota) {
      const sortedTags = tagMeta
        .filter(({ tag }) => (tagPointers[tag] ?? 0) < (byTag.get(tag)?.length ?? 0))
        .sort((a, b) => {
          const lessonDiff =
            (lessonCountOnDay.get(a.lessonId) ?? 0) - (lessonCountOnDay.get(b.lessonId) ?? 0)
          if (lessonDiff !== 0) return lessonDiff

          const countDiff = (typeAllocationCount[a.tag] ?? 0) - (typeAllocationCount[b.tag] ?? 0)
          if (countDiff !== 0) return countDiff
          const itemsA = byTag.get(a.tag)!
          const itemsB = byTag.get(b.tag)!
          const ptrA = tagPointers[a.tag] ?? 0
          const ptrB = tagPointers[b.tag] ?? 0
          const unpracticedDiff =
            unpracticedRemainingInTag(itemsB, ptrB) - unpracticedRemainingInTag(itemsA, ptrA)
          if (unpracticedDiff !== 0) return unpracticedDiff
          return a.typeOrder - b.typeOrder || a.minDiff - b.minDiff
        })

      if (sortedTags.length === 0) break

      const { tag, lessonId } = sortedTags[0]!
      const ptr = tagPointers[tag] ?? 0
      const picked = byTag.get(tag)![ptr]!
      tagPointers[tag] = ptr + 1
      dayProbs.push(picked.prob)
      lessonCountOnDay.set(lessonId, (lessonCountOnDay.get(lessonId) ?? 0) + 1)
      typeAllocationCount[tag] = (typeAllocationCount[tag] ?? 0) + 1
      remaining -= 1
    }

    days[dayIdx]!.problems = dayProbs
  }

  return { days, problemsPerDay }
}

/**
 * Build a flexible-date plan with type-aware daily allocation.
 * Types (Problem.tag) are ordered easy→hard; each day prioritizes types with fewer prior allocations.
 * Within a day, prefer spreading across lessons (avoid stacking the same lesson) before balancing tags.
 * Within each type, unpracticed problems are picked before practiced ones, then by difficulty asc.
 *
 * On edit (`freezeDate` + `existingDays`):
 * - Freeze days through freezeDate, and fully completed days after it (historical lists unchanged,
 *   even if the current filter/selection no longer includes those problems).
 * - Rebuild pool from the **current** filters only; problems already on kept frozen days are excluded.
 * - Problems on existing days that fall outside the new date range re-enter the pool (if still in filter).
 */
export function buildMathFlexiblePlan(
  lessonIds: string[],
  sectionFilters: Record<string, string[]>,
  problemSets: Record<string, ProblemSet>,
  startDate: string,
  endDate: string,
  tagFilters: Record<string, string[]> = {},
  practiceCount: Record<string, number> = {},
  options: BuildMathFlexiblePlanOptions = {},
): { days: MathWeeklyPlanDay[]; problemsPerDay: number } {
  const dates = enumerateDates(startDate, endDate)
  if (dates.length === 0) return { days: [], problemsPerDay: 0 }

  const fullPool = collectPoolItems(lessonIds, sectionFilters, problemSets, tagFilters, practiceCount)
  const { existingDays, freezeDate, progress } = options

  if (!freezeDate || !existingDays || existingDays.length === 0) {
    return allocatePoolAcrossDates(fullPool, dates)
  }

  const dateSet = new Set(dates)
  const frozenByDate = new Map<string, MathWeeklyPlanDay>()

  for (const day of existingDays) {
    if (!dateSet.has(day.date)) continue
    const freezeThroughBoundary = day.date <= freezeDate
    const freezeComplete = day.date > freezeDate && isExistingDayFullyComplete(day, progress)
    if (freezeThroughBoundary || freezeComplete) {
      frozenByDate.set(day.date, {
        date: day.date,
        problems: [...day.problems],
        optionalProblems: [...(day.optionalProblems ?? [])],
      })
    }
  }

  const frozenKeys = new Set<string>()
  for (const day of frozenByDate.values()) {
    for (const p of day.problems) frozenKeys.add(p.key)
    for (const p of day.optionalProblems ?? []) frozenKeys.add(p.key)
  }

  // Current filter pool minus anything already scheduled on kept frozen days.
  const rebuildPool = fullPool.filter((item) => !frozenKeys.has(item.prob.key))
  const rebuildDates = dates.filter((date) => !frozenByDate.has(date))
  const { days: rebuiltDays, problemsPerDay } = allocatePoolAcrossDates(rebuildPool, rebuildDates)
  const rebuiltByDate = new Map(rebuiltDays.map((d) => [d.date, d]))

  const days: MathWeeklyPlanDay[] = dates.map((date) => {
    const frozen = frozenByDate.get(date)
    if (frozen) return frozen
    return rebuiltByDate.get(date) ?? { date, problems: [], optionalProblems: [] }
  })

  // Prefer the rebuild quota when we still have open days; otherwise keep an overall average.
  const overallPerDay =
    days.length > 0
      ? Math.max(1, Math.ceil(days.reduce((n, d) => n + d.problems.length, 0) / days.length))
      : 0
  return {
    days,
    problemsPerDay: rebuildDates.length > 0 ? problemsPerDay : overallPerDay,
  }
}

export function planEndDate(plan: { planEnd?: string; weekStart: string; days: MathWeeklyPlanDay[] }): string {
  if (plan.planEnd) return plan.planEnd
  if (plan.days.length > 0) return plan.days[plan.days.length - 1]!.date
  const [y, m, d] = plan.weekStart.split('-').map(Number)
  const end = new Date(y, m - 1, d + 6)
  return toLocalDateStr(end)
}

export type OverduePlanProblem = {
  planStart?: string
  date: string
  problem: MathPlanProblem
  assignmentId: string
  deferred: boolean
}

/** Required problems on days before `today` that are not yet in that day's doneKeys. */
export function collectOverduePlanProblems(
  plan: Pick<MathWeeklyPlan, 'days' | 'progress'> &
    Partial<Pick<MathWeeklyPlan, 'weekStart' | 'deferredBatches'>>,
  today: string,
): OverduePlanProblem[] {
  const out: OverduePlanProblem[] = []
  const deferredSources = new Set(
    (plan.deferredBatches ?? []).flatMap((batch) => batch.sourceAssignmentIds),
  )
  for (const day of plan.days) {
    if (day.date >= today) continue
    const done = new Set((plan.progress[day.date] ?? { doneKeys: [] }).doneKeys)
    for (const p of day.problems) {
      const assignmentId = planAssignmentId(p, day.date)
      if (!isPlanProblemDone(p, day.date, done) && !deferredSources.has(assignmentId)) {
        out.push({
          planStart: plan.weekStart,
          date: day.date,
          problem: p,
          assignmentId,
          deferred: Boolean(p.isDeferred),
        })
      }
    }
  }
  return out
}

export type PlanProblemExecStatus = 'done' | 'pending'
export type PlanProblemAnswerStatus = 'wrong' | 'practiced' | 'unseen'

export function planProblemExecStatus(
  problemKey: string,
  doneKeys: ReadonlySet<string> | string[],
): PlanProblemExecStatus {
  const set = doneKeys instanceof Set ? doneKeys : new Set(doneKeys)
  return set.has(problemKey) ? 'done' : 'pending'
}

export function planProblemAnswerStatus(
  problemId: string,
  opts: { wrongIds: ReadonlySet<string>; practiceCount: Record<string, number> },
): PlanProblemAnswerStatus {
  if (opts.wrongIds.has(problemId)) return 'wrong'
  if ((opts.practiceCount[problemId] ?? 0) > 0) return 'practiced'
  return 'unseen'
}

export function addPlanDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + offset)
  return toLocalDateStr(dt)
}

export function enumeratePlanDates(startDate: string, endDate: string): string[] {
  return enumerateDates(startDate, endDate)
}

/** Dates already assigned to other plans (optionally excluding one plan being edited). */
export function getOccupiedPlanDates(
  plans: { weekStart: string; days: MathWeeklyPlanDay[] }[],
  excludeWeekStart?: string,
): Set<string> {
  const occupied = new Set<string>()
  for (const plan of plans) {
    if (excludeWeekStart && plan.weekStart === excludeWeekStart) continue
    for (const day of plan.days) {
      occupied.add(day.date)
    }
  }
  return occupied
}

export function planRangeOverlapsOccupied(
  startDate: string,
  endDate: string,
  occupied: Set<string>,
): boolean {
  if (!startDate || !endDate || endDate < startDate) return false
  for (const date of enumerateDates(startDate, endDate)) {
    if (occupied.has(date)) return true
  }
  return false
}

/** First contiguous free window of up to `defaultDays` days on or after `fromDate`. */
export function suggestAvailablePlanRange(
  occupied: Set<string>,
  fromDate: string,
  defaultDays = 7,
): { start: string; end: string } | null {
  let start = fromDate
  for (let guard = 0; guard < 730; guard++) {
    if (!occupied.has(start)) break
    start = addPlanDays(start, 1)
  }
  if (occupied.has(start)) return null

  let end = start
  for (let i = 1; i < defaultDays; i++) {
    const next = addPlanDays(end, 1)
    if (occupied.has(next)) break
    end = next
  }
  return { start, end }
}

export function buildMathWeeklyPlan(
  lessonId: string,
  problemSet: ProblemSet,
  weekStart: string,
  problemsPerDay = 3,
): MathWeeklyPlanDay[] {
  const lessonProbs = problemSet.lesson.map((p, i) => makeProblem(lessonId, 'lesson', p, i + 1))
  const homeworkProbs = problemSet.homework.map((p, i) => makeProblem(lessonId, 'homework', p, i + 1))
  const allWorkbookProbs = problemSet.workbook.map((p, i) => makeProblem(lessonId, 'workbook', p, i + 1))
  const pretestProbs = problemSet.pretest.map((p, i) => makeProblem(lessonId, 'pretest', p, i + 1))

  const required: MathPlanProblem[] = [
    ...lessonProbs,
    ...homeworkProbs,
    ...allWorkbookProbs.slice(0, 6),
    ...pretestProbs,
  ]
  const optional: MathPlanProblem[] = allWorkbookProbs.slice(6)

  // Distribute required problems across 7 days at problemsPerDay per day
  const [year, month, day] = weekStart.split('-').map(Number)
  const days: MathWeeklyPlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(year, month - 1, day + i)
    return {
      date: toLocalDateStr(d),
      problems: [],
      optionalProblems: [],
    }
  })

  required.forEach((prob, idx) => {
    const dayIdx = Math.min(Math.floor(idx / problemsPerDay), 6)
    days[dayIdx].problems.push(prob)
  })

  // Add optional problems to the last day that has required problems (or day 6)
  const lastFilledDay = Math.min(Math.floor((required.length - 1) / problemsPerDay), 6)
  days[lastFilledDay].optionalProblems = optional

  return days
}

export function getMathReviewProblemsForDay(
  today: string,
  allPriorKeys: string[],
  masteryMap: ProblemMasteryMap,
  thisWeekKeys: Set<string>,
  maxCount = 5,
): string[] {
  // A problem can occur in several historical/current plan rows. Review is
  // problem-based, so collapse those occurrences before ranking and rendering.
  const candidates = [...new Set(allPriorKeys)]
    .filter(key => {
      if (thisWeekKeys.has(key)) return false
      const m = masteryMap[key]
      if (!m) return false
      if (isGraduated(m)) return false
      const initialized = ensureStageInit(m, today)
      const due = initialized.nextReviewDate ?? today
      return due <= today
    })
    .map(key => {
      const m = ensureStageInit(masteryMap[key]!, today)
      const overdueDays = Math.max(
        0,
        Math.floor((Date.parse(today) - Date.parse(m.nextReviewDate ?? today)) / 86400000),
      )
      return { key, overdueDays, stage: m.stage ?? 0 }
    })
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage)
    .slice(0, maxCount)
    .map(({ key }) => key)

  return candidates
}

/**
 * Picks the best problem for "本周旧讲" review.
 * Selects the prior lesson with the lowest min(reviewCount), breaking ties by most recent lesson (highest ID).
 * Within that lesson, picks the problem with the lowest reviewCount.
 * Skips lessons with no problems.
 */
export function pickWeeklyLessonProblem(
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  reviewCounts: MathWeeklyLessonReviewState['reviewCounts'],
  excludeKeys: Set<string> = new Set(),
): { lessonId: string; problem: MathPlanProblem } | null {
  const entries = Object.entries(priorLessonProbs)
    .map(([id, probs]) => [id, probs.filter(p => !excludeKeys.has(p.key))] as [string, MathPlanProblem[]])
    .filter(([, probs]) => probs.length > 0)
  if (entries.length === 0) return null

  // Compute min reviewCount per lesson (after exclusion)
  const lessonMins = entries.map(([id, probs]) => ({
    id,
    probs,
    min: Math.min(...probs.map(p => reviewCounts[p.key] ?? 0)),
  }))

  // Sort by (min asc, id desc): lowest coverage first, most recent lesson wins ties
  lessonMins.sort((a, b) => a.min - b.min || Number(b.id) - Number(a.id))

  const best = lessonMins[0]!
  // Within best lesson, pick the problem with the lowest reviewCount
  const problem = best.probs.reduce((acc, p) =>
    (reviewCounts[p.key] ?? 0) < (reviewCounts[acc.key] ?? 0) ? p : acc,
  )
  return { lessonId: best.id, problem }
}

function initialPerLesson(): PerLessonRotationState {
  return { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
}

/**
 * Picks `needed` problems from one lesson's problem list, advancing that lesson's rotation state.
 * Returns the picked keys and the updated per-lesson state.
 */
function pickFromLesson(
  ls: PerLessonRotationState,
  probs: MathPlanProblem[],
  masteryMap: ProblemMasteryMap,
  needed: number,
  alreadyAssigned: Set<string>,
): { assignedKeys: string[]; newLessonState: PerLessonRotationState } {
  const total = probs.length
  if (total === 0) return { assignedKeys: [], newLessonState: ls }

  if (ls.phase === 'knowledge_points') {
    const assignedIndexes: number[] = []
    for (let i = 0; i < total && assignedIndexes.length < needed; i++) {
      const candidate = (ls.nextKpIndex + i) % total
      if (!ls.completedKpIndexes.includes(candidate)) {
        assignedIndexes.push(candidate)
      }
    }
    const assignedKeys = assignedIndexes.map(i => probs[i]!.key)
    const newCompleted = [...ls.completedKpIndexes, ...assignedIndexes]

    let newLessonState: PerLessonRotationState
    if (newCompleted.length >= total) {
      const hasErrors = probs.some(p => (masteryMap[p.key]?.incorrect ?? 0) > 0)
      newLessonState = hasErrors
        ? { nextKpIndex: 0, completedKpIndexes: newCompleted, phase: 'error_bank' }
        : { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
    } else {
      let next = (ls.nextKpIndex + assignedIndexes.length) % total
      while (newCompleted.includes(next) && newCompleted.length < total) {
        next = (next + 1) % total
      }
      newLessonState = { ...ls, completedKpIndexes: newCompleted, nextKpIndex: next }
    }
    return { assignedKeys, newLessonState }
  }

  // error_bank phase: pick errors not yet assigned globally
  const assignedKeys = probs
    .filter(p => (masteryMap[p.key]?.incorrect ?? 0) > 0 && !alreadyAssigned.has(p.key))
    .slice(0, needed)
    .map(p => p.key)
  const remaining = probs.filter(
    p => (masteryMap[p.key]?.incorrect ?? 0) > 0 && !alreadyAssigned.has(p.key) && !assignedKeys.includes(p.key),
  )
  const newLessonState: PerLessonRotationState = remaining.length === 0
    ? { nextKpIndex: 0, completedKpIndexes: [], phase: 'knowledge_points' }
    : ls
  return { assignedKeys, newLessonState }
}

/**
 * Assigns review problems for a given date from the next lesson in rotation.
 * Idempotent: if already assigned, returns unchanged state.
 * State advances on assignment, not on completion.
 */
export function assignRotatingReviewForDay(
  state: MathRotatingReviewState,
  date: string,
  priorLessonProbs: Record<string, MathPlanProblem[]>,
  masteryMap: ProblemMasteryMap,
  requiredCount: number,
  problemsPerDay: number,
): { assignedKeys: string[]; newState: MathRotatingReviewState } {
  if (state.dailyAssignments[date]) {
    return { assignedKeys: state.dailyAssignments[date], newState: state }
  }

  const { lessonOrder, nextLessonIndex } = state
  if (lessonOrder.length === 0) return { assignedKeys: [], newState: state }

  const needed = Math.max(1, problemsPerDay - requiredCount)
  const lessonId = lessonOrder[nextLessonIndex % lessonOrder.length]
  const lessonProbs = priorLessonProbs[lessonId] ?? []
  const lessonState = state.perLesson[lessonId] ?? initialPerLesson()
  const alreadyAssigned = new Set(Object.values(state.dailyAssignments).flat())

  const { assignedKeys, newLessonState } = pickFromLesson(
    lessonState, lessonProbs, masteryMap, needed, alreadyAssigned,
  )

  const newState: MathRotatingReviewState = {
    ...state,
    nextLessonIndex: nextLessonIndex + 1,
    perLesson: { ...state.perLesson, [lessonId]: newLessonState },
    dailyAssignments: { ...state.dailyAssignments, [date]: assignedKeys },
  }
  return { assignedKeys, newState }
}
