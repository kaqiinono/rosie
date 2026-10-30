'use client'

import { useMemo } from 'react'
import { useTaskMaterialsBridge } from '../materials/TaskMaterialsBridge'
import {
  getBookAccumulation,
  getBookLessonPassages,
  getBookPinyinWriteWords,
  getBookPoems,
  useChineseBookLessons,
} from '@rosie/chinese'
import { readingPassages, useWordData } from '@rosie/english'
import { useAuth } from '@rosie/core'
import { loadProblemVideoCatalog } from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import ProblemVideoReplay from '@rosie/math-kit/components/shared/ProblemVideoReplay'
import { problemVideoKey } from '@rosie/math-kit/utils/problem-video'
import { LESSONS } from '@rosie/math-kit/utils/lesson-registry'
import {
  TasksPage,
  type CatalogReadiness,
  type TaskMaterialAdapter,
  type TasksSection,
} from '@rosie/tasks'
import {
  adaptChineseCatalog,
  adaptEnglishCatalogSource,
  adaptMathCatalog,
  adaptMathProblems,
  catalogReadiness,
  chineseResources,
  CATALOG_READY,
  createTaskCatalogAdapter,
} from './taskCatalogAdapters'

/** Task 7 supplies shared-material access here; private task/story recordings are never catalog sources. */
export default function TasksHost({
  section = 'tasks',
  materialAdapter,
}: {
  section?: TasksSection
  materialAdapter?: TaskMaterialAdapter
}) {
  const { user } = useAuth()
  const bridge = useTaskMaterialsBridge()
  const { vocab, ready: wordsReady, error: wordsError } = useWordData(user)
  // Catalog reads only; this adapter never reads or writes a subject's learning progress.
  const g1b = useChineseBookLessons('g1b')
  const g2a = useChineseBookLessons('g2a')
  const g2b = useChineseBookLessons('g2b')
  const catalog = useMemo(() => {
    const books = [
      { book: 'g1b' as const, ...g1b },
      { book: 'g2a' as const, ...g2a },
      { book: 'g2b' as const, ...g2b },
    ]
    const bookReadiness = Object.fromEntries(
      books.map((row) => [row.book, catalogReadiness(row.ready, row.error)]),
    )
    const chinese = adaptChineseCatalog(
      books.map((row) => ({
        book: row.book,
        lessons: row.lessons,
        resources: Object.fromEntries(
          row.lessons.map((lesson) => {
            const key = lesson.lessonKey.split('::').pop()!
            return [
              key,
              chineseResources(key, lesson.unit, lesson.lesson, lesson.lessonKind, {
                passages: getBookLessonPassages(row.book),
                poems: getBookPoems(row.book),
                accumulation: getBookAccumulation(row.book),
                dictation: getBookPinyinWriteWords(row.book),
                chars: row.lessonGroups,
              }),
            ]
          }),
        ),
      })),
    )
    const chineseReady = catalogReadiness(
      books.every((row) => row.ready),
      books.find((row) => row.error)?.error ?? null,
    )
    const englishSource = adaptEnglishCatalogSource(
      vocab,
      readingPassages,
      catalogReadiness(wordsReady, wordsError),
    )
    const readiness = {
      chinese: chineseReady,
      english: englishSource.readiness,
      math: CATALOG_READY,
    }
    const adapter = createTaskCatalogAdapter({
      chinese,
      english: englishSource.lessons,
      math: adaptMathCatalog(LESSONS),
      readiness,
      materials: materialAdapter ?? bridge.materials,
      readinessFor: (subject, selection): CatalogReadiness =>
        subject === 'chinese' && selection?.book
          ? (bookReadiness[selection.book] ?? {
              status: 'error',
              complete: false,
              error: 'unknown_book',
            })
          : (readiness[subject as keyof typeof readiness] ?? {
              status: 'loading',
              complete: false,
              error: null,
            }),
      loadMathProblems: async (key) => {
        const { lessonModuleByKey } = await import('@rosie/math/utils/lesson-module-registry')
        const lessonModule = lessonModuleByKey(key)
        const lesson = LESSONS.find((row) => row.lessonKey === key)
        if (!lessonModule || !lesson) throw new Error('未找到该讲题库')
        const verified = user
          ? await loadProblemVideoCatalog(user.id, key).catch(() => new Set<string>())
          : new Set<string>()
        const replays: Record<string, string> = {}
        for (const [group, problems] of Object.entries(lessonModule.PROBLEMS))
          for (const problem of problems) {
            const videoKey = problemVideoKey(problem)
            if (videoKey && verified.has(videoKey))
              replays[`${group}:${problem.id}`] =
                `/math/ny/${lesson.grade}/${lesson.seq}/${group}/${encodeURIComponent(problem.id)}`
          }
        return adaptMathProblems(lesson, lessonModule.PROBLEMS, replays)
      },
    })
    return {
      ...adapter,
      renderMaterialPicker: bridge.renderMaterialPicker,
      renderCourseMaterials: bridge.renderCourseMaterials,
      renderTaskMaterials: bridge.renderTaskMaterials,
      renderProblemReplay: (problem: import('@rosie/tasks').ProblemOption) =>
        problem.replay_ref ? <ProblemVideoReplay problem={problem} /> : null,
    }
  }, [user, g1b, g2a, g2b, vocab, wordsReady, wordsError, materialAdapter, bridge])
  return <TasksPage section={section} catalog={catalog} />
}
