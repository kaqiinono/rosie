'use client'

import LessonSidebar from '@rosie/math/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useLesson42 } from './Lesson42Provider'

const BASE = '/math/ny/1/42'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-rose-50 font-bold text-rose-700',
  sections: [
    { key: 'pretest',    path: `${BASE}/pretest`,    icon: '📝', label: '课前测' },
    { key: 'lesson',     path: `${BASE}/lesson`,     icon: '📖', label: '课堂讲解' },
    { key: 'homework',   path: `${BASE}/homework`,   icon: '✏️', label: '课后巩固' },
    { key: 'workbook',   path: `${BASE}/workbook`,   icon: '📚', label: '拓展练习' },
    { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '附加题' },
    { key: 'alltest',    path: `${BASE}/alltest`,    icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson42} />
}
