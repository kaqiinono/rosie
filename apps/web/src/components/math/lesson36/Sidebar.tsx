'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@/utils/type'
import { useLesson36 } from './Lesson36Provider'

const BASE = '/math/ny/36'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-blue-50 font-bold text-app-blue-dark',
  sections: [
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
    { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
    { key: 'mistakes', path: `${BASE}/mistakes`, icon: '📕', label: '错题本' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
  ],
  extraLinks: [{ key: 'magic', path: `${BASE}/magic`, icon: '🌈', label: '魔法书' }],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson36} />
}
