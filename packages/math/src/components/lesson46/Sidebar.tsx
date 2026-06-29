'use client'

import LessonSidebar from '@rosie/math/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useLesson46 } from './Lesson46Provider'

const BASE = '/math/ny/46'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-teal-50 font-bold text-teal-700',
  sections: [
    { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
    { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '附加题' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
    { key: 'mistakes', path: `${BASE}/mistakes`, icon: '📕', label: '错题本' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson46} />
}
