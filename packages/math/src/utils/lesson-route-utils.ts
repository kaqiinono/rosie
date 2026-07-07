import type { ProblemSet } from '@rosie/core'
import { lessonByRoute, routeForLesson, type LessonEntry } from '@rosie/math/utils/lesson-registry'
import { lessonModuleBySlug, type LessonModule } from '@rosie/math/utils/lesson-module-registry'

export type ResolvedLessonRoute = {
  entry: LessonEntry
  module: LessonModule
  basePath: string
  grade: number
  seq: number
}

export function resolveLessonRoute(grade: number, seq: number): ResolvedLessonRoute | undefined {
  const entry = lessonByRoute(grade, seq)
  if (!entry) return undefined
  const lessonModule = lessonModuleBySlug(entry.slug)
  if (!lessonModule) return undefined
  return {
    entry,
    module: lessonModule,
    basePath: routeForLesson(entry),
    grade,
    seq,
  }
}

/** Parse `/math/ny/2` → grade 2. */
export function parseGradeFromPath(pathname: string): number | null {
  const m = pathname.match(/^\/math\/ny\/(\d+)(?:\/|$)/)
  if (!m) return null
  const grade = Number(m[1])
  return Number.isFinite(grade) ? grade : null
}

/** Parse `/math/ny/2/4` → { grade: 2, seq: 4 }. */
export function parseGradeSeqFromPath(pathname: string): { grade: number; seq: number } | null {
  const m = pathname.match(/^\/math\/ny\/(\d+)\/(\d+)(?:\/|$)/)
  if (!m) return null
  const grade = Number(m[1])
  const seq = Number(m[2])
  if (!Number.isFinite(grade) || !Number.isFinite(seq)) return null
  return { grade, seq }
}

export type ParsedCanonicalLessonPath = {
  basePath: string
  section?: string
  problemIndex?: number
}

/** Parse `/math/ny/2/1/lesson/3` style paths. */
export function parseCanonicalLessonPath(pathname: string): ParsedCanonicalLessonPath | null {
  const m = pathname.match(/^\/math\/ny\/(\d+)\/(\d+)(?:\/([^/]+)(?:\/(\d+))?)?/)
  if (!m) return null
  const basePath = `/math/ny/${m[1]}/${m[2]}`
  const section = m[3]
  const problemIndex = m[4] ? parseInt(m[4], 10) : undefined
  return { basePath, section, problemIndex }
}

export function sectionCounts(problems: ProblemSet): Record<string, number> {
  return {
    pretest: problems.pretest.length,
    lesson: problems.lesson.length,
    homework: problems.homework.length,
    workbook: problems.workbook.length,
    supplement: problems.supplement?.length ?? 0,
  }
}

export function nextProblemHref(
  pathname: string,
  problems: ProblemSet,
): string | undefined {
  const parsed = parseCanonicalLessonPath(pathname)
  if (!parsed?.section || parsed.problemIndex === undefined) return undefined
  const counts = sectionCounts(problems)
  const total = counts[parsed.section]
  if (!total || parsed.problemIndex >= total) return undefined
  return `${parsed.basePath}/${parsed.section}/${parsed.problemIndex + 1}`
}
