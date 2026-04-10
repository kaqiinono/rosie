'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@/utils/type'
import { useLesson38 } from './Lesson38Provider'

const BASE = '/math/ny/38'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-purple-50 font-bold text-purple-700',
  sections: [
    { key: 'pretest',    path: `${BASE}/pretest`,    icon: '📝', label: '课前测' },
    { key: 'lesson',     path: `${BASE}/lesson`,     icon: '📖', label: '课堂讲解' },
    { key: 'homework',   path: `${BASE}/homework`,   icon: '✏️', label: '课后巩固' },
    { key: 'workbook',   path: `${BASE}/workbook`,   icon: '📚', label: '拓展练习' },
    { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '附加题' },
  ],
  extraLinks: [
    { key: 'magic', path: `${BASE}/magic`, icon: '✏️', label: '魔法书' },
  ],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson38} />
}
