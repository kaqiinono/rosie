'use client'

import LessonAppHeader from '@rosie/math-kit/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson9 } from './G2Lesson9Provider'

const CONFIG = {
  basePath: '/math/ny/2/9',
  emoji: '✖️',
  titleShort: '乘除巧算',
  titleFull: '乘除法巧算',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson9} />
}
