'use client'

import type { ProblemSet } from '@rosie/core'
import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import { useG2Lesson14 } from './G2Lesson14Provider'

const CONFIG = {
  basePath: '/math/ny/2/14',
  emoji: '🔢',
  titleShort: '枚举法进阶',
  titleFull: '枚举法进阶',
  titleColor: 'text-teal-700',
  navActiveColor: 'text-teal-700',
  navActiveBorderColor: '#0f766e',
} as const
export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson14} />
}
