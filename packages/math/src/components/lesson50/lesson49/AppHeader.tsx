'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson49 } from './Lesson49Provider'

const CONFIG = {
  basePath: '/math/ny/2/1',
  emoji: '🧮',
  titleShort: '巧算',
  titleFull: '速算',
  titleColor: 'text-indigo-700',
  navActiveColor: 'text-indigo-700',
  navActiveBorderColor: '#4338ca',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson49} />
}
