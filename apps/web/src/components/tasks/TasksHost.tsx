'use client'

import { useMemo } from 'react'
import { getBookAccumulation, getBookLessonPassages, getBookPinyinWriteWords, getBookPoems, useChineseBookLessons } from '@rosie/chinese'
import { readingPassages, useWordData } from '@rosie/english'
import { useAuth } from '@rosie/core'
import { LESSONS } from '@rosie/math-kit/utils/lesson-registry'
import { TasksPage, type CatalogReadiness, type TaskMaterialAdapter, type TasksSection } from '@rosie/tasks'
import { adaptChineseCatalog, adaptEnglishCatalogSource, adaptMathCatalog, adaptMathProblems, catalogReadiness, chineseResources, CATALOG_READY, createTaskCatalogAdapter } from './taskCatalogAdapters'

/** Task 7 supplies shared-material access here; private task/story recordings are never catalog sources. */
export default function TasksHost({ section = 'tasks', materialAdapter }: { section?: TasksSection; materialAdapter?: TaskMaterialAdapter }) {
  const { user } = useAuth()
  const { vocab, ready: wordsReady, error: wordsError } = useWordData(user)
  // Catalog reads only; this adapter never reads or writes a subject's learning progress.
  const g1b = useChineseBookLessons('g1b')
  const g2a = useChineseBookLessons('g2a')
  const g2b = useChineseBookLessons('g2b')
  const catalog = useMemo(() => {
    const books = [{ book: 'g1b' as const, ...g1b }, { book: 'g2a' as const, ...g2a }, { book: 'g2b' as const, ...g2b }]
    const bookReadiness = Object.fromEntries(books.map(row => [row.book, catalogReadiness(row.ready, row.error)]))
    const chinese = adaptChineseCatalog(books.map(row => ({ book: row.book, lessons: row.lessons, resources: Object.fromEntries(row.lessons.map(lesson => {
      const key = lesson.lessonKey.split('::').pop()!
      return [key, chineseResources(key, lesson.unit, lesson.lesson, lesson.lessonKind, { passages: getBookLessonPassages(row.book), poems: getBookPoems(row.book), accumulation: getBookAccumulation(row.book), dictation: getBookPinyinWriteWords(row.book), chars: row.lessonGroups })]
    })) })))
    const chineseReady = catalogReadiness(books.every(row => row.ready), books.find(row => row.error)?.error ?? null)
    const englishSource = adaptEnglishCatalogSource(vocab, readingPassages, catalogReadiness(wordsReady, wordsError))
    const readiness = { chinese: chineseReady, english: englishSource.readiness, math: CATALOG_READY }
    return createTaskCatalogAdapter({
      chinese, english: englishSource.lessons, math: adaptMathCatalog(LESSONS), readiness, materials: materialAdapter,
      readinessFor: (subject, selection): CatalogReadiness => subject === 'chinese' && selection?.book ? bookReadiness[selection.book] ?? { status: 'error', complete: false, error: 'unknown_book' } : readiness[subject as keyof typeof readiness] ?? { status: 'loading', complete: false, error: null },
      loadMathProblems: async key => {
        const { lessonModuleByKey } = await import('@rosie/math/utils/lesson-module-registry')
        const lessonModule = lessonModuleByKey(key)
        const lesson = LESSONS.find(row => row.lessonKey === key)
        if (!lessonModule || !lesson) throw new Error('未找到该讲题库')
        // Replay remains unknown until an application caller supplies verified catalog matches.
        return adaptMathProblems(lesson, lessonModule.PROBLEMS)
      },
    })
  }, [g1b, g2a, g2b, vocab, wordsReady, wordsError, materialAdapter])
  return <TasksPage section={section} catalog={catalog} />
}
