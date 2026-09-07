'use client'

import LessonSidebar from '@rosie/math-kit/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson9 } from './G2Lesson9Provider'

const BASE = '/math/ny/2/9'
const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-amber-50 font-bold text-amber-700',
  sections: [
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useG2Lesson9} />
}
