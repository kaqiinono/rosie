'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson35 } from './G1Lesson35Provider'

const CONFIG = {
  basePath: '/math/ny/1/35',
  emoji: '🐦',
  titleShort: '归一',
  titleFull: '问题探险',
  titleColor: 'text-yellow-dark',
  navActiveColor: 'text-yellow-dark',
  navActiveBorderColor: '#f59e0b',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson35} />
}
