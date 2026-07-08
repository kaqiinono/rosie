'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useG2Lesson3 } from './G2Lesson3Provider'

const CONFIG = {
  basePath: '/math/ny/2/3',
  emoji: '⚖️',
  titleShort: '代换归一',
  titleFull: '探险',
  titleColor: 'text-emerald-700',
  navActiveColor: 'text-emerald-700',
  navActiveBorderColor: '#047857',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useG2Lesson3} />
}
