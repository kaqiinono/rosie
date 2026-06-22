'use client'

import LessonSidebar from '@/components/math/shared/LessonSidebar'
import type { ProblemSet } from '@/utils/type'
import { useLesson34 } from './Lesson34Provider'

const BASE = '/math/ny/34'

const CONFIG = {
  basePath: BASE,
  activeClass: 'bg-amber-50 font-bold text-amber-800',
  sections: [
    { key: 'lesson', path: `${BASE}/lesson`, icon: '📖', label: '课堂讲解' },
    { key: 'homework', path: `${BASE}/homework`, icon: '✏️', label: '课后巩固' },
    { key: 'workbook', path: `${BASE}/workbook`, icon: '📚', label: '拓展练习' },
    { key: 'supplement', path: `${BASE}/supplement`, icon: '📒', label: '补充题' },
    { key: 'alltest', path: `${BASE}/alltest`, icon: '🎯', label: '综合题库' },
    { key: 'pretest', path: `${BASE}/pretest`, icon: '📝', label: '课前测' },
    { key: 'mistakes', path: `${BASE}/mistakes`, icon: '📕', label: '错题本' },
  ],
  extraLinks: [
    { key: 'magic', path: `${BASE}/magic`, icon: '🌈', label: '魔法书' },
  ],
} as const

export default function Sidebar({ problems }: { problems: ProblemSet }) {
  return <LessonSidebar config={CONFIG} problems={problems} useLessonContext={useLesson34} />
}
