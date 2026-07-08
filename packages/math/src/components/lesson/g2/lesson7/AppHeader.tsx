'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson7 } from './G2Lesson7Provider'

const CONFIG = {
  basePath: '/math/ny/2/7',
  emoji: '🔐',
  titleShort: '数字谜',
  titleFull: '探险',
  titleColor: 'text-sky-700',
  navActiveColor: 'text-sky-700',
  navActiveBorderColor: '#0369a1',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson7} />
}
