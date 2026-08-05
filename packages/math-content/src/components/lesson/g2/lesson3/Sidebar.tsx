'use client'

import LessonSidebar from '@rosie/math-kit/components/shared/LessonSidebar'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson3 } from './G2Lesson3Provider'

const BASE = '/math/ny/2/3'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-emerald-50 font-bold text-emerald-700',
  sections: [
    { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '附加题' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useG2Lesson3} />
}
