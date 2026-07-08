'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson39 } from './G1Lesson39Provider'

const CONFIG = {
  basePath: '/math/ny/1/39',
  emoji: '⚖️',
  titleShort: '盈亏',
  titleFull: '探险',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson39} />
}
