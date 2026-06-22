'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useLesson29 } from './Lesson29Provider'

const BASE = '/math/ny/29'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-rose-50 font-bold text-rose-700',
  sections: [
    { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`,  icon: '✏️', label: '课后巩固' },
    { key: 'alltest',  path: `${BASE}/alltest`,   icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson29} />
}
