'use client'

import LessonSidebar from '@rosie/math-kit/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson30 } from './G1Lesson30Provider'

const BASE = '/math/ny/1/30'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-amber-50 font-bold text-amber-700',
  sections: [
    { key: 'pretest',  path: `${BASE}/pretest`,  icon: '📝', label: '课前测' },
    { key: 'lesson',   path: `${BASE}/lesson`,   icon: '📖', label: '课堂讲解' },
    { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
    { key: 'alltest',  path: `${BASE}/alltest`,  icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useG1Lesson30} />
}
