'use client'

import type { ProblemSet } from '@rosie/core'
import LessonSidebar from '@rosie/math-kit/components/shared/LessonSidebar'
import { useG2Lesson14 } from './G2Lesson14Provider'

const BASE = '/math/ny/2/14'
const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-teal-50 font-bold text-teal-700',
  sections: [
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const
export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useG2Lesson14} />
}
