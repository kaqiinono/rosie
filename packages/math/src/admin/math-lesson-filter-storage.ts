import { STORAGE_KEYS } from '@rosie/core'
import { defaultLessonForGrade, gradesInOrder, lessonsForGrade } from '@rosie/math/utils/lesson-grade'

export type MathLessonFilterSaved = {
  selectedGrade: number
  selectedLessons: string[]
  sourceFilter: string[]
  typeFilter: string[]
}

export function readMathLessonFilter(): MathLessonFilterSaved | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.ADMIN_MATH_LESSON_FILTER)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MathLessonFilterSaved
    if (
      typeof parsed.selectedGrade !== 'number' ||
      !Array.isArray(parsed.selectedLessons) ||
      !Array.isArray(parsed.sourceFilter) ||
      !Array.isArray(parsed.typeFilter)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeMathLessonFilter(saved: MathLessonFilterSaved): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.ADMIN_MATH_LESSON_FILTER, JSON.stringify(saved))
  } catch {
    /* ignore */
  }
}

function defaultLessonsForGrade(grade: number): string[] {
  const id = defaultLessonForGrade(grade)
  return id ? [id] : []
}

export function resolveInitialGradeAndLessons(): {
  grade: number
  lessons: string[]
  saved: MathLessonFilterSaved | null
} {
  const grades = gradesInOrder()
  const defaultGrade = grades[grades.length - 1] ?? 2
  const saved = readMathLessonFilter()

  if (!saved || !grades.includes(saved.selectedGrade)) {
    return { grade: defaultGrade, lessons: defaultLessonsForGrade(defaultGrade), saved: null }
  }

  const validIds = new Set(lessonsForGrade(saved.selectedGrade))
  const lessons = saved.selectedLessons.filter((id) => validIds.has(id))
  return {
    grade: saved.selectedGrade,
    lessons: lessons.length > 0 ? lessons : defaultLessonsForGrade(saved.selectedGrade),
    saved,
  }
}
