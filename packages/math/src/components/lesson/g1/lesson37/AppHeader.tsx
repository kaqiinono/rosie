'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG1Lesson37 } from './G1Lesson37Provider'

const CONFIG = {
  basePath: '/math/ny/1/37',
  emoji: '🐔',
  titleShort: '鸡兔同笼',
  titleFull: '假设法探险',
  titleColor: 'text-blue-700',
  navActiveColor: 'text-blue-700',
  navActiveBorderColor: '#3b82f6',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG1Lesson37} />
}
