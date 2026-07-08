// @rosie/math — public API for app consumers.
// Most of the math surface (lesson components, data, hooks) is imported via deep
// subpaths, e.g. '@rosie/math/components/lesson/g1/lesson35/ProblemDetail',
// '@rosie/math/utils/g1/lesson35-data', '@rosie/math/hooks/useMathWeeklyPlan'.
// A barrel for those would collide — every lesson exports the same names
// (HomePage / ProblemList / ProblemDetail / PROBLEMS). This index only re-exports
// the top-level entry cards as a stable, non-colliding public surface.
export { default as CourseCard } from './components/CourseCard'
export { default as MathDailyCard } from './components/MathDailyCard'
export { default as MathSeaCard } from './components/MathSeaCard'
export { default as MathFavoritesCard } from './components/MathFavoritesCard'
export { MathFavoritesProvider } from './components/MathFavoritesProvider'
export { PracticeQueueProvider } from './components/shared/practice-queue/PracticeQueueContext'
export { default as MathQuizCard } from './components/MathQuizCard'
export { default as MathCatalogCard } from './components/MathCatalogCard'
export { default as MathPriorityCard } from './components/MathPriorityCard'
export { default as MathMistakesCard } from './components/MathMistakesCard'
export { default as GradeCard } from './components/GradeCard'
export {
  LESSON_GRADE,
  GRADE_LABEL,
  gradesInOrder,
  gradesForLanding,
  highestGrade,
  gradeForNewLesson,
  lessonsForGrade,
  lessonKeysForGrade,
  gradeOf,
  lessonIdFromHref,
  lessonKeyFromHref,
  lessonDisplayNum,
  lessonDisplayLabel,
} from './utils/lesson-grade'
export {
  LESSONS,
  type LessonEntry,
  lessonByKey,
  lessonByRoute,
  compareLessonIds,
  lessonRoutePath,
  routeForLesson,
  lessonFromHref,
  problemIdForLesson,
  lessonKeyFromProblemId,
  lessonSummaryProblemId,
  isLessonSummaryProblemId,
  lessonDisplaySeq,
  lessonDisplayLabelFromRegistry,
  lessonsForGradeRegistry,
  gradesInOrderFromRegistry,
  highestGradeFromRegistry,
} from './utils/lesson-registry'

// Admin
export { default as MathImageManagerPage } from './admin/MathImageManagerPage'
export { default as MathLessonIdAuditPage } from './admin/MathLessonIdAuditPage'
