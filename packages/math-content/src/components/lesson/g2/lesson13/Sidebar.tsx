'use client'

import type { ProblemSet } from '@rosie/core'
import LessonSidebar from '@rosie/math-kit/components/shared/LessonSidebar'
import { useG2Lesson13 } from './G2Lesson13Provider'

const BASE = '/math/ny/2/13'
const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-amber-50 font-bold text-amber-700',
  sections: [
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const
export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useG2Lesson13} />
}
