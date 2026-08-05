// @rosie/math — top-layer public API for app consumers (aggregators, cards, plan/
// quiz/sea engine). Lesson content + data banks live in @rosie/math-content, and
// shared foundation (hooks, primitives, ScratchPad) in @rosie/math-kit, both imported
// via deep subpaths, e.g. '@rosie/math-content/components/lesson/g1/lesson35/ProblemDetail',
// '@rosie/math-content/utils/g1/lesson35-data', '@rosie/math-kit/hooks/useMathWeeklyPlan'.
// A barrel for content would collide — every lesson exports the same names
// (HomePage / ProblemList / ProblemDetail / PROBLEMS). This index only re-exports
// the top-level entry cards as a stable, non-colliding public surface.
export { default as CourseCard } from './components/CourseCard'
export { default as MathDailyCard } from './components/MathDailyCard'
export { default as MathSeaCard } from './components/MathSeaCard'
export { default as MathFavoritesCard } from './components/MathFavoritesCard'
export { MathFavoritesProvider } from '@rosie/math-kit/components/MathFavoritesProvider'
export { PracticeQueueProvider } from './components/shared/practice-queue/PracticeQueueContext'
export { default as MathQuizCard } from './components/MathQuizCard'
export { default as MathCatalogCard } from './components/MathCatalogCard'
export { default as MathNotesCard } from './components/MathNotesCard'
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
} from '@rosie/math-kit/utils/lesson-grade'
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
} from '@rosie/math-kit/utils/lesson-registry'

// Admin
export { default as MathImageManagerPage } from './admin/MathImageManagerPage'
export { default as MathLessonIdAuditPage } from './admin/MathLessonIdAuditPage'
