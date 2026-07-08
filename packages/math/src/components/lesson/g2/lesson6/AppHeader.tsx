'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson6 } from './G2Lesson6Provider'

const CONFIG = {
  basePath: '/math/ny/2/6',
  emoji: '🔢',
  titleShort: '简单枚举',
  titleFull: '探险',
  titleColor: 'text-teal-700',
  navActiveColor: 'text-teal-700',
  navActiveBorderColor: '#0f766e',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson6} />
}
