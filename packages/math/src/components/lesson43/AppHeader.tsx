'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson43 } from './Lesson43Provider'

const CONFIG = {
  basePath: '/math/ny/43',
  emoji: '📊',
  titleShort: '数列',
  titleFull: '探险',
  titleColor: 'text-cyan-700',
  navActiveColor: 'text-cyan-700',
  navActiveBorderColor: '#0891b2',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson43} />
}
