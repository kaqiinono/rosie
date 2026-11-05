'use client'

import type { ProblemSet } from '@rosie/core'
import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import { useG2Lesson13 } from './G2Lesson13Provider'

const CONFIG = {
  basePath: '/math/ny/2/13',
  emoji: '🌳',
  titleShort: '抽屉与植树',
  titleFull: '抽屉原理初步与植树问题',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const
export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson13} />
}
