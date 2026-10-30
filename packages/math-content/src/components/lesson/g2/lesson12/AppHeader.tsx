'use client'

import type { ProblemSet } from '@rosie/core'
import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import { useG2Lesson12 } from './G2Lesson12Provider'

const CONFIG = {
  basePath: '/math/ny/2/12',
  emoji: '⚖️',
  titleShort: '盈亏问题',
  titleFull: '盈亏问题初步',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const
export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson12} />
}
