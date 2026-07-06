'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson55 } from './Lesson55Provider'

const CONFIG = {
  basePath: '/math/ny/55',
  emoji: '🔢',
  titleShort: '简单枚举',
  titleFull: '探险',
  titleColor: 'text-teal-700',
  navActiveColor: 'text-teal-700',
  navActiveBorderColor: '#0f766e',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson55} />
}
