'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson13 } from './Lesson13Provider'

const CONFIG = {
  basePath: '/math/ny/13',
  emoji: '🌳',
  titleShort: '植树',
  titleFull: '问题',
  titleColor: 'text-green-700',
  navActiveColor: 'text-green-700',
  navActiveBorderColor: '#16a34a',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson13} />
}
