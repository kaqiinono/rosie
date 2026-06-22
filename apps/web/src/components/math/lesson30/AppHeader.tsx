'use client'

import LessonAppHeader from '@/components/math/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson30 } from './Lesson30Provider'

const CONFIG = {
  basePath: '/math/ny/30',
  emoji: '🧮',
  titleShort: '和差倍',
  titleFull: '进阶',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#d97706',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson30} />
}
