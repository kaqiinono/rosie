'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson12 } from './Lesson12Provider'

const CONFIG = {
  basePath: '/math/ny/1/12',
  emoji: '🔢',
  titleShort: '巧算',
  titleFull: '进阶',
  titleColor: 'text-orange-700',
  navActiveColor: 'text-orange-700',
  navActiveBorderColor: '#ea580c',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson12} />
}
