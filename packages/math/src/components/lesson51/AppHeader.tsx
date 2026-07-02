'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson51 } from './Lesson51Provider'

const CONFIG = {
  basePath: '/math/ny/51',
  emoji: '⚖️',
  titleShort: '代换归一',
  titleFull: '探险',
  titleColor: 'text-emerald-700',
  navActiveColor: 'text-emerald-700',
  navActiveBorderColor: '#047857',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson51} />
}
