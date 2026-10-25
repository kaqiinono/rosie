'use client'

import { useMemo } from 'react'
import { useChineseBookLessons } from '@rosie/chinese'
import { readingPassages, useWordData } from '@rosie/english'
import { useAuth } from '@rosie/core'
import { LESSONS } from '@rosie/math-kit/utils/lesson-registry'
import { TasksPage, type TaskCatalogAdapter, type TasksSection, type LessonRef } from '@rosie/tasks'

export default function TasksHost({ section = 'tasks' }: { section?: TasksSection }) {
  const { user } = useAuth()
  const { vocab } = useWordData(user)
  // Catalog reads only; this adapter never reads or writes a subject's learning progress.
  const g1b = useChineseBookLessons('g1b')
  const g2a = useChineseBookLessons('g2a')
  const g2b = useChineseBookLessons('g2b')
  const catalog = useMemo<TaskCatalogAdapter>(() => {
    const chinese = ([['g1b', g1b.lessons], ['g2a', g2a.lessons], ['g2b', g2b.lessons]] as const).flatMap(([book, rows]) => rows.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(l => ({ key: l.lessonKey.includes('::') ? l.lessonKey : `${book}::${l.lessonKey}`, title: l.lessonTitle, book, unit: String(l.unit), kind: l.lessonKind, href: `/chinese/${book}/units/${l.unit}` })))
    const stages = [...new Set([...readingPassages, ...vocab].filter(p => p.stage && ['4A', '5A'].includes(p.stage)).map(p => p.stage!))].sort()
    const english: LessonRef[] = stages.flatMap(stage => {
      const units = [...new Set([...readingPassages, ...vocab].filter(p => p.stage === stage).map(p => Number(p.unit.match(/\d+/)?.[0] ?? 1)))].sort((a, b) => a - b)
      return units.flatMap(unit => [1, 2, 3].map(lesson => {
        const passage = readingPassages.find(p => p.stage === stage && p.unit === `Unit ${unit}` && p.lesson === `Lesson ${lesson}`)
        return { key: `${stage.toLowerCase()}-u${unit}l${lesson}`, title: `Unit ${unit} · L${lesson}${passage ? ` · ${passage.title}` : ''}`, book: stage, unit: String(unit), lesson, kind: 'lesson', ...(passage ? { href: `/english/words/reading/${passage.key}` } : {}) }
      }))
    })
    return {
      chinese, english,
      math: LESSONS.map(l => ({ key: l.lessonKey, title: `${l.grade} 年级 · 第 ${l.seq} 讲`, book: `${l.grade} 年级`, unit: String(l.seq), kind: 'lesson', href: `/math/ny/${l.grade}/${l.seq}` })),
      loadMathProblems: async key => {
        const { lessonModuleByKey } = await import('@rosie/math/utils/lesson-module-registry')
        const lessonModule = lessonModuleByKey(key)
        const lesson = LESSONS.find(l => l.lessonKey === key)
        if (!lessonModule || !lesson) throw new Error('未找到该讲题库')
        return (['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const).flatMap(group => (lessonModule.PROBLEMS[group] ?? []).map(p => ({ key: `${group}:${p.id}`, title: p.title, href: `/math/ny/${lesson.grade}/${lesson.seq}/${group}/${encodeURIComponent(p.id)}` })))
      },
    }
  }, [g1b.lessons, g2a.lessons, g2b.lessons, vocab])
  return <TasksPage section={section} catalog={catalog} />
}
