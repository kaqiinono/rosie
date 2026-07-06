'use client'

import LessonAppHeader from '@rosie/math/components/shared/LessonAppHeader'
import type { ProblemSet } from '@rosie/core'
import { useLesson53 } from './Lesson53Provider'

const CONFIG = {
  basePath: '/math/ny/53',
  emoji: '🔮',
  titleShort: '找规律',
  titleFull: '探险',
  titleColor: 'text-amber-700',
  navActiveColor: 'text-amber-700',
  navActiveBorderColor: '#b45309',
} as const

export default function AppHeader({ problems }: { problems: ProblemSet }) {
  return <LessonAppHeader config={CONFIG} problems={problems} useLessonContext={useLesson53} />
}
