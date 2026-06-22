'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@/utils/type'
import { useLesson30 } from './Lesson30Provider'

const BASE = '/math/ny/30'

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
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson30} />
}
